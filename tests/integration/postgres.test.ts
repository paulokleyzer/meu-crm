import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "@/server/migrate";
import {
  IdempotencyConflict,
  PostgresCrmRepository,
  RevisionConflict,
} from "@/server/postgres-repository";
import { createSeedData } from "@/lib/seed";
import {
  deletePipeline,
  moveDeal,
  saveCustomer,
  updatePipeline,
} from "@/lib/crm";

if (!process.env.TEST_DATABASE_URL)
  throw new Error(
    "TEST_DATABASE_URL é obrigatório. Esta suíte não usa mocks nem DATABASE_URL como fallback.",
  );
const schema = `crm_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 2,
});
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 4,
  options: `-c search_path=${schema}`,
});
const repo = new PostgresCrmRepository(pool);
beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(pool);
});
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});
async function seed() {
  const current = await repo.load();
  return repo.save({
    data: createSeedData(),
    baseRevision: current.revision,
    requestId: randomUUID(),
    operation: "import",
  });
}

describe("PostgreSQL real: persistência, concorrência e recuperação", () => {
  it("aplica as migrações de forma repetível e inicia um funil válido", async () => {
    await migrate(pool);
    const state = await repo.load();
    expect(state.revision).toBe(0);
    expect(state.data.pipelines).toHaveLength(1);
    expect(state.data.deals).toHaveLength(0);
  });
  it("grava todas as entidades e recupera por uma nova conexão", async () => {
    const saved = await seed();
    const freshPool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    try {
      const recovered = await new PostgresCrmRepository(freshPool).load();
      expect(recovered.revision).toBe(saved.revision);
      expect(recovered.data.pipelines).toEqual(saved.data.pipelines);
      expect(recovered.data.customers).toHaveLength(10);
      expect(recovered.data.deals).toHaveLength(12);
      expect(recovered.data.activities).toHaveLength(12);
      for (const table of [
        "crm_pipelines",
        "crm_stages",
        "crm_customers",
        "crm_deals",
        "crm_activities",
        "crm_history",
      ]) {
        expect(
          Number(
            (await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count,
          ),
        ).toBeGreaterThan(0);
      }
    } finally {
      await freshPool.end();
    }
  });
  it("preserva etapas vazias, movimentações, ordem, datas e centavos", async () => {
    const original = await seed();
    const data = moveDeal(original.data, "deal-0", "partner-meeting");
    data.deals.find((d) => d.id === "deal-0")!.value = 1234.56;
    const saved = await repo.save({
      data,
      baseRevision: original.revision,
      requestId: randomUUID(),
      operation: "change",
    });
    const read = await repo.load();
    const deal = read.data.deals.find((d) => d.id === "deal-0")!;
    expect(deal).toMatchObject({
      pipelineId: "pipeline-partners",
      stageId: "partner-meeting",
      value: 1234.56,
      position: 0,
    });
    expect(deal.expectedCloseDate).toBe(data.deals[0].expectedCloseDate);
    expect(read.data.activities.at(-1)!.text).toContain("Reunião");
    expect(read.revision).toBe(saved.revision);
  });
  it("aceita só uma de duas gravações simultâneas da mesma revisão", async () => {
    const base = await seed();
    const results = await Promise.allSettled(
      ["Dispositivo A", "Dispositivo B"].map((name) =>
        repo.save({
          data: saveCustomer(base.data, {
            name,
            company: "Fictícia",
            email: "",
            phone: "",
          }),
          baseRevision: base.revision,
          requestId: randomUUID(),
          operation: "change",
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(RevisionConflict);
    const final = await repo.load();
    expect(final.revision).toBe(base.revision + 1);
    expect(final.data.customers).toHaveLength(11);
  });
  it("torna uma repetição da mesma requisição idempotente e rejeita ID reaproveitado", async () => {
    const base = await seed();
    const request = {
      data: moveDeal(base.data, "deal-1", "stage-closing"),
      baseRevision: base.revision,
      requestId: randomUUID(),
      operation: "change" as const,
    };
    const first = await repo.save(request),
      repeated = await repo.save(request);
    expect(repeated.revision).toBe(first.revision);
    expect(
      Number(
        (
          await pool.query(
            "SELECT count(*) FROM crm_history WHERE request_id=$1",
            [request.requestId],
          )
        ).rows[0].count,
      ),
    ).toBe(1);
    await expect(
      repo.save({ ...request, data: base.data }),
    ).rejects.toBeInstanceOf(IdempotencyConflict);
  });
  it("rejeita backup inválido sem alterar o banco", async () => {
    const base = await seed();
    await expect(
      repo.save({
        ...base,
        data: { ...base.data, customers: [] },
        baseRevision: base.revision,
        requestId: randomUUID(),
        operation: "import",
      }),
    ).rejects.toThrow();
    expect((await repo.load()).revision).toBe(base.revision);
    expect((await repo.load()).data.customers).toHaveLength(10);
  });
  it("faz rollback completo quando uma restrição SQL falha após iniciar a substituição", async () => {
    const base = await seed();
    await pool.query(
      "CREATE FUNCTION fail_test_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER fail_test_write BEFORE INSERT ON crm_deals FOR EACH ROW EXECUTE FUNCTION fail_test_write()",
    );
    try {
      await expect(
        repo.save({
          data: moveDeal(base.data, "deal-0", "stage-closing"),
          baseRevision: base.revision,
          requestId: randomUUID(),
          operation: "change",
        }),
      ).rejects.toThrow();
      const after = await repo.load();
      expect(after.revision).toBe(base.revision);
      expect(after.data.deals.find((d) => d.id === "deal-0")!.stageId).toBe(
        "stage-lead",
      );
      expect(after.data.customers).toHaveLength(10);
    } finally {
      await pool.query("DROP TRIGGER fail_test_write ON crm_deals");
      await pool.query("DROP FUNCTION fail_test_write()");
    }
  });
  it("preserva negócios ao excluir etapas e funis e mantém o histórico anterior à importação", async () => {
    const base = await seed();
    let data = updatePipeline(base.data, "pipeline-sales", {
      ...base.data.pipelines[0],
      stages: base.data.pipelines[0].stages.slice(1),
    });
    data = deletePipeline(data, "pipeline-sales", "pipeline-partners");
    await repo.save({
      data,
      baseRevision: base.revision,
      requestId: randomUUID(),
      operation: "import",
    });
    const final = await repo.load();
    expect(final.data.deals).toHaveLength(12);
    expect(final.data.pipelines).toHaveLength(1);
    const history = await pool.query(
      "SELECT before_data, after_data FROM crm_history ORDER BY revision DESC LIMIT 1",
    );
    expect(history.rows[0].before_data.pipelines).toHaveLength(2);
    expect(history.rows[0].after_data.pipelines).toHaveLength(1);
  });
});
