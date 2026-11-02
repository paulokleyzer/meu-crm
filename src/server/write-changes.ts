import type { PoolClient } from "pg";
import type { CrmData } from "../lib/types";

type Row = Record<string, unknown> & { id: string };
const definitions = {
  crm_pipelines: "id text, name text, description text, position integer",
  crm_stages:
    "id text, pipeline_id text, name text, probability integer, position integer",
  crm_customers:
    "id text, name text, company text, email text, phone text, created_at timestamptz",
  crm_deals:
    "id text, title text, value numeric(14,2), customer_id text, pipeline_id text, stage_id text, status text, priority text, owner text, source text, expected_close_date date, notes text, position integer, created_at timestamptz, updated_at timestamptz",
  crm_activities:
    "id text, deal_id text, text text, created_at timestamptz, position integer",
} as const;
type Table = keyof typeof definitions;
function rows(data: CrmData): Record<Table, Row[]> {
  return {
    crm_pipelines: data.pipelines.map((p, position) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      position,
    })),
    crm_stages: data.pipelines.flatMap((p) =>
      p.stages.map((s, position) => ({
        id: s.id,
        pipeline_id: p.id,
        name: s.name,
        probability: s.probability,
        position,
      })),
    ),
    crm_customers: data.customers.map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone,
      created_at: c.createdAt,
    })),
    crm_deals: data.deals.map((d) => ({
      id: d.id,
      title: d.title,
      value: d.value,
      customer_id: d.customerId,
      pipeline_id: d.pipelineId,
      stage_id: d.stageId,
      status: d.status,
      priority: d.priority,
      owner: d.owner,
      source: d.source,
      expected_close_date: d.expectedCloseDate || null,
      notes: d.notes,
      position: d.position,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    })),
    crm_activities: data.activities.map((a, position) => ({
      id: a.id,
      deal_id: a.dealId,
      text: a.text,
      created_at: a.createdAt,
      position,
    })),
  };
}
export async function writeChanges(
  client: PoolClient,
  before: CrmData,
  after: CrmData,
) {
  const old = rows(before),
    next = rows(after);
  // All table/column names below are constants, never submitted SQL. Each batch
  // binds JSON as a single value and touches only records which changed.
  for (const table of Object.keys(definitions) as Table[]) {
    const previous = new Map(
      old[table].map((row) => [row.id, JSON.stringify(row)]),
    );
    const changed = next[table].filter(
      (row) => previous.get(row.id) !== JSON.stringify(row),
    );
    if (!changed.length) continue;
    const columns = Object.keys(changed[0]);
    const updates = columns
      .filter((c) => c !== "id")
      .map((c) => `${c}=EXCLUDED.${c}`)
      .join(",");
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) SELECT ${columns.join(",")} FROM jsonb_to_recordset($1::jsonb) AS batch(${definitions[table]}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
      [JSON.stringify(changed)],
    );
  }
  for (const table of [
    "crm_activities",
    "crm_deals",
    "crm_stages",
    "crm_pipelines",
    "crm_customers",
  ] as Table[]) {
    const retained = new Set(next[table].map((row) => row.id));
    const removed = old[table]
      .filter((row) => !retained.has(row.id))
      .map((row) => row.id);
    if (removed.length)
      await client.query(`DELETE FROM ${table} WHERE id=ANY($1::text[])`, [
        removed,
      ]);
  }
}
