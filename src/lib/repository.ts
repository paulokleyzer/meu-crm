import type { CrmData } from "./types";
import { parseCrmData } from "./schema";

export const STORAGE_KEY = "meu-crm:data:v1";

/** Synchronous local storage boundary. An HTTP adapter will need async operations. */
export interface CrmRepository {
  load(): CrmData | null;
  save(data: CrmData): void;
}

export class LocalCrmRepository implements CrmRepository {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem">) {}
  load(): CrmData | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return parseCrmData(JSON.parse(raw));
  }
  save(data: CrmData) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(parseCrmData(data)));
  }
}
