import type { CrmData } from "./types";

export interface VersionedData {
  data: CrmData;
  revision: number;
}
export interface WriteRequest {
  data: CrmData;
  baseRevision: number;
  requestId: string;
  operation: "change" | "import" | "chat_import";
}
export interface UpdateOptions {
  editToken?: number;
  operation?: "change" | "import" | "chat_import";
}
export type UpdateCrm = (
  recipe: (data: CrmData) => CrmData,
  options?: UpdateOptions,
) => Promise<boolean>;
