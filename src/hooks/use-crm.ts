"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { CrmData } from "@/lib/types";
import { LocalCrmRepository, STORAGE_KEY } from "@/lib/repository";
import { createSeedData } from "@/lib/seed";
import { parseCrmData } from "@/lib/schema";

type Snapshot = { data: CrmData | null; storageError: string };
const serverSnapshot: Snapshot = { data: null, storageError: "" };
let snapshot: Snapshot = serverSnapshot;
let initialized = false;
let locked = false;
const listeners = new Set<() => void>();
function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function initialize() {
  if (initialized) return;
  initialized = true;
  let data: CrmData;
  let storageError = "";
  try {
    const repo = new LocalCrmRepository(window.localStorage);
    const saved = repo.load();
    data = saved || createSeedData();
    if (!saved) repo.save(data);
  } catch {
    data = createSeedData();
    locked = true;
    storageError =
      "Não foi possível ler ou salvar os dados locais. As alterações ficarão apenas nesta sessão. Exporte um backup antes de sair. Os dados anteriores foram preservados.";
  }
  emit({ data, storageError });
}

function sync(event: StorageEvent) {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    const data = parseCrmData(JSON.parse(event.newValue));
    emit({ ...snapshot, data });
    toast.info(
      "Dados atualizados em outra aba. Reabra formulários em edição para usar a versão mais recente.",
    );
  } catch {
    locked = true;
    emit({
      ...snapshot,
      storageError:
        "Outra aba gravou dados inválidos. Exporte um backup antes de recarregar.",
    });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  initialize();
  if (listeners.size === 1) window.addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", sync);
  };
}
function getSnapshot() {
  return snapshot;
}

function update(recipe: (data: CrmData) => CrmData): boolean {
  if (!snapshot.data) return false;
  try {
    const data = parseCrmData(recipe(snapshot.data));
    let storageError = snapshot.storageError;
    if (!locked) {
      try {
        new LocalCrmRepository(window.localStorage).save(data);
        storageError = "";
      } catch {
        storageError =
          "O armazenamento local está indisponível ou cheio. Alterações apenas nesta sessão; exporte um backup antes de sair.";
      }
    }
    emit({ data, storageError });
    return true;
  } catch (error) {
    toast.error(
      error instanceof Error && !error.message.startsWith("[")
        ? error.message
        : "Verifique os campos. Os dados informados são inválidos.",
    );
    return false;
  }
}

export function useCrm() {
  return {
    ...useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot),
    update,
  };
}
