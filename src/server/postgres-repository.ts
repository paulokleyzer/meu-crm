import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { writeChanges } from "./write-changes";
import { parseCrmData } from "../lib/schema";
import type { VersionedData, WriteRequest } from "../lib/api-types";
import { transaction } from "./database";

export class RevisionConflict extends Error {}
export class IdempotencyConflict extends Error {}

export class PostgresCrmRepository {
  constructor(private readonly pool: Pool) {}
  async load(): Promise<VersionedData> {
    const result = await this.loadIfChanged(-1);
    if (!result) throw new Error("INVALID_SNAPSHOT");
    return result;
  }
  async loadIfChanged(knownRevision: number): Promise<VersionedData | null> {
    const result = await this.pool.query(
      "SELECT revision, CASE WHEN revision=$1 THEN NULL ELSE snapshot END AS data FROM crm_state WHERE singleton=true",
      [knownRevision],
    );
    const row = result.rows[0];
    if (!row) throw new Error("MIGRATIONS_REQUIRED");
    if (row.data === null) return null;
    return { data: parseCrmData(row.data), revision: Number(row.revision) };
  }
  async save(
    input: Omit<WriteRequest, "operation"> & {
      operation: WriteRequest["operation"] | "seed";
    },
  ): Promise<VersionedData> {
    const data = parseCrmData(input.data);
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          data,
          baseRevision: input.baseRevision,
          operation: input.operation,
        }),
      )
      .digest("hex");
    return transaction(this.pool, async (client) => {
      const state = await client.query(
        "SELECT revision,snapshot FROM crm_state WHERE singleton=true FOR UPDATE",
      );
      if (!state.rows.length) throw new Error("MIGRATIONS_REQUIRED");
      const previous = await client.query(
        "SELECT payload_hash FROM crm_history WHERE request_id=$1",
        [input.requestId],
      );
      if (previous.rows.length) {
        if (previous.rows[0].payload_hash !== hash)
          throw new IdempotencyConflict();
        return {
          data: parseCrmData(state.rows[0].snapshot),
          revision: Number(state.rows[0].revision),
        };
      }
      const base = Number(state.rows[0].revision);
      if (base !== input.baseRevision) throw new RevisionConflict();
      const before = parseCrmData(state.rows[0].snapshot);
      await writeChanges(client, before, data);
      const revision = base + 1;
      await client.query(
        "UPDATE crm_state SET revision=$1,snapshot=$2 WHERE singleton=true",
        [revision, JSON.stringify(data)],
      );
      await client.query(
        "INSERT INTO crm_history(revision,request_id,payload_hash,operation,before_data,after_data) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          revision,
          input.requestId,
          hash,
          input.operation,
          JSON.stringify(before),
          JSON.stringify(data),
        ],
      );
      return { data, revision };
    });
  }
  async history(after = 0) {
    return (
      await this.pool.query(
        "SELECT revision,operation,created_at FROM crm_history WHERE revision>$1 ORDER BY revision DESC LIMIT 100",
        [after],
      )
    ).rows.map((row) => ({
      revision: Number(row.revision),
      operation: row.operation,
      createdAt: row.created_at.toISOString(),
    }));
  }
}
