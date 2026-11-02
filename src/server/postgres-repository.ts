import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { parseCrmData } from "../lib/schema";
import type { CrmData } from "../lib/types";
import type { VersionedData, WriteRequest } from "../lib/api-types";
import { transaction } from "./database";

export class RevisionConflict extends Error {}
export class IdempotencyConflict extends Error {}

async function readData(client: PoolClient): Promise<CrmData> {
  const pipelines = (
    await client.query("SELECT * FROM crm_pipelines ORDER BY position")
  ).rows;
  const stages = (
    await client.query("SELECT * FROM crm_stages ORDER BY position")
  ).rows;
  const customers = (
    await client.query("SELECT * FROM crm_customers ORDER BY created_at,id")
  ).rows;
  const deals = (
    await client.query(
      "SELECT *, to_char(expected_close_date,'YYYY-MM-DD') AS close_date FROM crm_deals ORDER BY position,id",
    )
  ).rows;
  const activities = (
    await client.query("SELECT * FROM crm_activities ORDER BY position")
  ).rows;
  return parseCrmData({
    schemaVersion: 1,
    pipelines: pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      stages: stages
        .filter((s) => s.pipeline_id === p.id)
        .map((s) => ({ id: s.id, name: s.name, probability: s.probability })),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone,
      createdAt: c.created_at.toISOString(),
    })),
    deals: deals.map((d) => ({
      id: d.id,
      title: d.title,
      value: Number(d.value),
      customerId: d.customer_id,
      pipelineId: d.pipeline_id,
      stageId: d.stage_id,
      status: d.status,
      priority: d.priority,
      owner: d.owner,
      source: d.source,
      expectedCloseDate: d.close_date || "",
      notes: d.notes,
      position: d.position,
      createdAt: d.created_at.toISOString(),
      updatedAt: d.updated_at.toISOString(),
    })),
    activities: activities.map((a) => ({
      id: a.id,
      dealId: a.deal_id,
      text: a.text,
      createdAt: a.created_at.toISOString(),
    })),
  });
}

async function writeData(client: PoolClient, data: CrmData) {
  // The revision row serializes writers. FK-safe replacement happens entirely
  // inside the transaction; concurrent readers see the previous complete state.
  await client.query("DELETE FROM crm_activities");
  await client.query("DELETE FROM crm_deals");
  await client.query("DELETE FROM crm_stages");
  await client.query("DELETE FROM crm_pipelines");
  await client.query("DELETE FROM crm_customers");
  for (const [index, p] of data.pipelines.entries()) {
    await client.query("INSERT INTO crm_pipelines VALUES ($1,$2,$3,$4)", [
      p.id,
      p.name,
      p.description,
      index,
    ]);
    for (const [position, s] of p.stages.entries())
      await client.query("INSERT INTO crm_stages VALUES ($1,$2,$3,$4,$5)", [
        s.id,
        p.id,
        s.name,
        s.probability,
        position,
      ]);
  }
  for (const c of data.customers)
    await client.query("INSERT INTO crm_customers VALUES ($1,$2,$3,$4,$5,$6)", [
      c.id,
      c.name,
      c.company,
      c.email,
      c.phone,
      c.createdAt,
    ]);
  for (const d of data.deals)
    await client.query(
      "INSERT INTO crm_deals VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
      [
        d.id,
        d.title,
        d.value,
        d.customerId,
        d.pipelineId,
        d.stageId,
        d.status,
        d.priority,
        d.owner,
        d.source,
        d.expectedCloseDate || null,
        d.notes,
        d.position,
        d.createdAt,
        d.updatedAt,
      ],
    );
  for (const [index, a] of data.activities.entries())
    await client.query("INSERT INTO crm_activities VALUES ($1,$2,$3,$4,$5)", [
      a.id,
      a.dealId,
      a.text,
      a.createdAt,
      index,
    ]);
}

export class PostgresCrmRepository {
  constructor(private readonly pool: Pool) {}
  load(): Promise<VersionedData> {
    return transaction(
      this.pool,
      async (client) => {
        const state = await client.query(
          "SELECT revision FROM crm_state WHERE singleton=true",
        );
        if (!state.rows.length) throw new Error("MIGRATIONS_REQUIRED");
        return {
          data: await readData(client),
          revision: Number(state.rows[0].revision),
        };
      },
      true,
    );
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
        "SELECT revision FROM crm_state WHERE singleton=true FOR UPDATE",
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
          data: await readData(client),
          revision: Number(state.rows[0].revision),
        };
      }
      const base = Number(state.rows[0].revision);
      if (base !== input.baseRevision) throw new RevisionConflict();
      const before = await readData(client);
      await writeData(client, data);
      const revision = base + 1;
      await client.query(
        "UPDATE crm_state SET revision=$1 WHERE singleton=true",
        [revision],
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
