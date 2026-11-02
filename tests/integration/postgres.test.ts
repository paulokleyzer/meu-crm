import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { migrate } from "@/server/migrate";
import {
  IdempotencyConflict,
  PostgresCrmRepository,
  RevisionConflict,
} from "@/server/postgres-repository";
import { createSeedData } from "@/lib/seed";
import {
  saveCatalog,
  saveDistributionRule,
  saveScheduledActivity,
  simulateIntake,
} from "@/lib/crm-v2";
import { enforceDemoLimit, DemoLimitExceeded } from "@/server/demo-limit";
import {
  recordVerifiedWhatsAppEvent,
  resumeConversationAI,
  ConversationVersionConflict,
} from "@/server/whatsapp";
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
  it("atualiza o esquema anterior preservando registros, datas, valores e revisão", async () => {
    const upgradeSchema = `${schema}_upgrade`;
    const directory = await mkdtemp(join(tmpdir(), "crm-legacy-migration-"));
    await admin.query(`CREATE SCHEMA ${upgradeSchema}`);
    const legacy = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${upgradeSchema}`,
    });
    try {
      await copyFile(
        join(process.cwd(), "netlify/database/migrations/001_crm.sql"),
        join(directory, "001_crm.sql"),
      );
      await migrate(legacy, directory);
      await legacy.query(
        "INSERT INTO crm_customers(id,name,created_at) VALUES ('legacy-customer','Cliente fictício anterior','2026-01-02T03:04:05.123Z')",
      );
      await legacy.query(
        `INSERT INTO crm_deals(id,title,value,customer_id,pipeline_id,stage_id,status,priority,owner,position,created_at,updated_at,expected_close_date,source)
         VALUES ('legacy-deal','Oportunidade fictícia anterior',1234.56,'legacy-customer','pipeline-sales','stage-lead','open','medium','Equipe fictícia',0,'2026-01-02T03:04:05.123Z','2026-01-02T03:04:05.123Z','2026-03-04','Origem legada livre')`,
      );
      await legacy.query(
        "INSERT INTO crm_activities VALUES ('legacy-activity','legacy-deal','Atividade fictícia anterior','2026-01-02T03:04:05.123Z',0)",
      );
      await legacy.query("UPDATE crm_state SET revision=7");
      await migrate(legacy);
      const recovered = await new PostgresCrmRepository(legacy).load();
      expect(recovered.revision).toBe(7);
      expect(recovered.data.sources[0].name).toBe("Origem legada livre");
      expect(recovered.data.sellers[0].name).toBe("Equipe fictícia");
      expect(recovered.data.schemaVersion).toBe(2);
      expect(recovered.data.customers[0].createdAt).toBe(
        "2026-01-02T03:04:05.123Z",
      );
      expect(recovered.data.deals[0]).toMatchObject({
        id: "legacy-deal",
        value: 1234.56,
        expectedCloseDate: "2026-03-04",
        pipelineId: "pipeline-sales",
        stageId: "stage-lead",
      });
      expect(recovered.data.activities[0].text).toBe(
        "Atividade fictícia anterior",
      );
    } finally {
      await legacy.end();
      await admin.query(`DROP SCHEMA ${upgradeSchema} CASCADE`);
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("responde à revisão inalterada com uma única consulta sem ler entidades", async () => {
    const base = await repo.load();
    const spy = vi.spyOn(pool, "query");
    try {
      expect(await repo.loadIfChanged(base.revision)).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][0])).toContain("CASE WHEN revision");
    } finally {
      spy.mockRestore();
    }
  });
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
  it("um movimento não regrava clientes e mantém o snapshot coerente com as tabelas", async () => {
    const base = await seed();
    await pool.query(
      "CREATE FUNCTION protect_unchanged_customers() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unnecessary write'; END $$",
    );
    await pool.query(
      "CREATE TRIGGER protect_unchanged_customers BEFORE INSERT OR UPDATE ON crm_customers FOR EACH ROW EXECUTE FUNCTION protect_unchanged_customers()",
    );
    try {
      const saved = await repo.save({
        data: moveDeal(base.data, "deal-0", "partner-meeting"),
        baseRevision: base.revision,
        requestId: randomUUID(),
        operation: "change",
      });
      const physical = (await pool.query("SELECT crm_build_snapshot() AS data"))
        .rows[0].data;
      const deal = physical.deals.find(
        (d: { id: string }) => d.id === "deal-0",
      );
      expect(deal.stageId).toBe("partner-meeting");
      expect(physical.customers).toHaveLength(saved.data.customers.length);
      expect(physical.deals).toHaveLength(saved.data.deals.length);
    } finally {
      await pool.query(
        "DROP TRIGGER protect_unchanged_customers ON crm_customers",
      );
      await pool.query("DROP FUNCTION protect_unchanged_customers()");
    }
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
  it("persiste categorias, origens, responsáveis, regras e agenda nas tabelas e no snapshot", async () => {
    const base = await seed();
    let data = saveCatalog(base.data, "businessTypes", "Energia de teste");
    data = saveCatalog(data, "sources", "Campanha de teste");
    data = saveCatalog(data, "sellers", "Vendedor de teste");
    const businessTypeId = data.businessTypes[0].id;
    data = saveDistributionRule(data, {
      name: "Regra de teste",
      businessTypeId,
      source: "Campanha de teste",
      pipelineId: "pipeline-partners",
      enabled: true,
      isDefault: false,
    });
    data = simulateIntake(data, {
      name: "Contato fictício de banco",
      businessTypeId,
      source: "Campanha de teste",
    });
    const deal = data.deals.at(-1)!;
    data = saveScheduledActivity(data, {
      title: "Reunião fictícia",
      type: "meeting",
      customerId: deal.customerId,
      dealId: deal.id,
      owner: "Vendedor de teste",
      dueAt: "2027-02-03T12:30:00.000Z",
      notes: "Somente teste",
      remindBeforeMinutes: 30,
    });
    const saved = await repo.save({
      data,
      baseRevision: base.revision,
      requestId: randomUUID(),
      operation: "change",
    });
    expect((await repo.load()).data).toEqual(saved.data);
    expect(
      (
        await pool.query(
          "SELECT business_type_id,source FROM crm_deals WHERE id=$1",
          [deal.id],
        )
      ).rows[0],
    ).toMatchObject({
      business_type_id: businessTypeId,
      source: "Campanha de teste",
    });
    expect(
      (await pool.query("SELECT name FROM crm_distribution_rules")).rows[0]
        .name,
    ).toBe("Regra de teste");
    expect(
      (await pool.query("SELECT title,owner FROM crm_scheduled_activities"))
        .rows[0],
    ).toMatchObject({ title: "Reunião fictícia", owner: "Vendedor de teste" });
    const physical = (await pool.query("SELECT crm_build_snapshot() AS data"))
      .rows[0].data;
    expect(physical.scheduledActivities[0]).toEqual(
      saved.data.scheduledActivities[0],
    );
    expect(physical.businessTypes).toEqual(saved.data.businessTypes);
  });
  it("aplica limite público compartilhado e atômico, inclusive entre conexões simultâneas", async () => {
    vi.stubEnv("CRM_ACCESS_MODE", "demo");
    try {
      await pool.query(
        "INSERT INTO crm_demo_limits VALUES ('write:global',now(),599)",
      );
      const attempts = await Promise.allSettled(
        [0, 1].map(() =>
          enforceDemoLimit(
            pool,
            new Request("http://127.0.0.1:3000/api/crm", { method: "PUT" }),
          ),
        ),
      );
      expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const denied = attempts.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      expect(denied.reason).toBeInstanceOf(DemoLimitExceeded);
      await pool.query(
        "UPDATE crm_demo_limits SET window_start=now()-interval '2 minutes'",
      );
      await expect(
        enforceDemoLimit(
          pool,
          new Request("http://127.0.0.1:3000/api/crm", { method: "PUT" }),
        ),
      ).resolves.toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
      await pool.query("DELETE FROM crm_demo_limits");
    }
  });
  it("prepara histórico oficial e pausa persistente da IA sem conectar o WhatsApp", async () => {
    const event = {
      eventId: "fictional-event-1",
      messageId: "fictional-message-1",
      externalContactId: "fictional-contact-only",
      direction: "incoming" as const,
      senderKind: "customer" as const,
      body: "Mensagem fictícia de teste",
      occurredAt: "2026-01-02T12:00:00.000Z",
    };
    const first = await recordVerifiedWhatsAppEvent(pool, event);
    expect((await recordVerifiedWhatsAppEvent(pool, event)).duplicate).toBe(
      true,
    );
    expect(
      Number(
        (await pool.query("SELECT count(*) FROM crm_messages")).rows[0].count,
      ),
    ).toBe(1);
    await resumeConversationAI(pool, first.conversationId, 1);
    await recordVerifiedWhatsAppEvent(pool, {
      ...event,
      eventId: "human-echo-2",
      messageId: "human-message-2",
      direction: "outgoing",
      senderKind: "human",
    });
    expect(
      (
        await pool.query(
          "SELECT ai_paused,ai_pause_reason FROM crm_conversations WHERE id=$1",
          [first.conversationId],
        )
      ).rows[0],
    ).toMatchObject({ ai_paused: true, ai_pause_reason: "human_reply" });
    await recordVerifiedWhatsAppEvent(pool, {
      ...event,
      eventId: "incoming-3",
      messageId: "message-3",
    });
    expect(
      (
        await pool.query(
          "SELECT ai_paused FROM crm_conversations WHERE id=$1",
          [first.conversationId],
        )
      ).rows[0].ai_paused,
    ).toBe(true);
    await expect(
      resumeConversationAI(pool, first.conversationId, 2),
    ).rejects.toBeInstanceOf(ConversationVersionConflict);
    await resumeConversationAI(pool, first.conversationId, 4);
    expect(
      (
        await pool.query(
          "SELECT ai_paused FROM crm_conversations WHERE id=$1",
          [first.conversationId],
        )
      ).rows[0].ai_paused,
    ).toBe(false);
  });
});
