import type { VersionedData, WriteRequest } from "./api-types";
import { parseCrmData } from "./schema";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
async function decode(response: Response): Promise<VersionedData> {
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error || "Não foi possível acessar o servidor.",
      response.status,
    );
  if (!Number.isSafeInteger(result.revision) || result.revision < 0)
    throw new Error("Resposta inválida do servidor.");
  return { data: parseCrmData(result.data), revision: result.revision };
}
export class HttpCrmRepository {
  async load(knownRevision?: number): Promise<VersionedData | null> {
    const response = await fetch("/api/crm", {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers:
        knownRevision === undefined
          ? {}
          : { "If-None-Match": `"revision-${knownRevision}"` },
    });
    if (response.status === 304) return null;
    return decode(response);
  }
  async save(input: WriteRequest): Promise<VersionedData> {
    const options: RequestInit = {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    };
    let response: Response;
    try {
      response = await fetch("/api/crm", {
        ...options,
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      // Retry an uncertain network result with the SAME request ID and payload.
      // PostgreSQL records the ID atomically with the write, preventing duplicates.
      response = await fetch("/api/crm", {
        ...options,
        signal: AbortSignal.timeout(12000),
      });
    }
    return decode(response);
  }
}
