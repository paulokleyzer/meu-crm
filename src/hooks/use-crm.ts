"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { CrmData } from "@/lib/types";
import type { UpdateCrm, VersionedData } from "@/lib/api-types";
import { ApiError, HttpCrmRepository } from "@/lib/http-repository";
import { parseCrmData } from "@/lib/schema";
import { syncInterval } from "@/lib/sync-policy";

type Snapshot = {
  data: CrmData | null;
  storageError: string;
  saving: boolean;
  revision: number;
};
const serverSnapshot: Snapshot = {
  data: null,
  storageError: "",
  saving: false,
  revision: 0,
};
let snapshot = serverSnapshot;
let confirmed: VersionedData | null = null;
let initializing: Promise<void> | null = null;
let externalEditToken = 0;
let refreshing = false;
let queue = Promise.resolve();
const listeners = new Set<() => void>();
const repository = new HttpCrmRepository();
let lastActivity = Date.now();
let lastRefresh = 0;
export function getEditToken() {
  return externalEditToken;
}
function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export async function refreshCrm() {
  if (snapshot.saving || refreshing) return;
  refreshing = true;
  lastRefresh = Date.now();
  try {
    const result = await repository.load(confirmed?.revision);
    if (!result) {
      if (snapshot.storageError) emit({ ...snapshot, storageError: "" });
      return;
    }
    if (snapshot.saving || (confirmed && result.revision < confirmed.revision))
      return;
    if (confirmed && result.revision !== confirmed.revision) {
      externalEditToken++;
      toast.info(
        "Dados atualizados por outro dispositivo. Reabra formulários em edição antes de salvar.",
      );
    }
    confirmed = result;
    emit({ ...result, storageError: "", saving: false });
  } catch {
    emit({
      ...snapshot,
      storageError:
        "Não foi possível acessar o PostgreSQL. As alterações precisam de confirmação do servidor. Verifique a conexão e tente novamente.",
    });
  } finally {
    refreshing = false;
  }
}
function initialize() {
  return (initializing ||= refreshCrm());
}
function getSnapshot() {
  return snapshot;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  void initialize();
  const timer = setInterval(() => {
    const now = Date.now();
    const interval = syncInterval(
      document.visibilityState === "visible",
      now - lastActivity,
    );
    if (interval !== null && now - lastRefresh >= interval) void refreshCrm();
  }, 5000);
  const activity = () => {
    lastActivity = Date.now();
  };
  window.addEventListener("pointerdown", activity, { passive: true });
  window.addEventListener("keydown", activity, { passive: true });
  const visible = () => {
    if (document.visibilityState === "visible") {
      activity();
      void refreshCrm();
    }
  };
  window.addEventListener("focus", visible);
  document.addEventListener("visibilitychange", visible);
  return () => {
    listeners.delete(listener);
    clearInterval(timer);
    window.removeEventListener("focus", visible);
    window.removeEventListener("pointerdown", activity);
    window.removeEventListener("keydown", activity);
    document.removeEventListener("visibilitychange", visible);
  };
}
const update: UpdateCrm = (recipe, options = {}) => {
  let resolve!: (result: boolean) => void;
  const result = new Promise<boolean>((r) => {
    resolve = r;
  });
  queue = queue
    .then(async () => {
      if (!confirmed) {
        resolve(false);
        return;
      }
      if (
        options.editToken !== undefined &&
        options.editToken !== externalEditToken
      ) {
        toast.error(
          "Este formulário ficou desatualizado. Preserve suas anotações, feche e reabra os detalhes antes de salvar.",
        );
        resolve(false);
        return;
      }
      try {
        const data = parseCrmData(recipe(confirmed.data));
        emit({ ...snapshot, data, saving: true, storageError: "" });
        const saved = await repository.save({
          data,
          baseRevision: confirmed.revision,
          requestId: crypto.randomUUID(),
          operation: options.operation || "change",
        });
        if (saved.revision !== confirmed.revision + 1) externalEditToken++;
        confirmed = saved;
        emit({ ...saved, saving: false, storageError: "" });
        resolve(true);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          externalEditToken++;
          emit({ ...snapshot, data: confirmed.data, saving: false });
          await refreshCrm();
        }
        const message =
          error instanceof ApiError
            ? error.message
            : "Não foi possível gravar a alteração. Os dados confirmados foram mantidos; revise os campos e tente novamente.";
        emit({
          ...snapshot,
          data: confirmed.data,
          revision: confirmed.revision,
          saving: false,
          storageError: message,
        });
        toast.error(message);
        resolve(false);
      }
    })
    .catch(() => {
      resolve(false);
    });
  return result;
};
export function useCrm() {
  return {
    ...useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot),
    update,
    refresh: refreshCrm,
  };
}
