import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NetlifyDB } from "@netlify/database-dev";
import { getPool, releaseRequestPool } from "@/server/database";
import { PostgresCrmRepository } from "@/server/postgres-repository";
import { createSeedData } from "@/lib/seed";
import { moveDeal } from "@/lib/crm";
import { migrate } from "@/server/migrate";
import {
  saveCatalog,
  saveDistributionRule,
  saveScheduledActivity,
} from "@/lib/crm-v2";

let directory: string;
let db: NetlifyDB;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "crm-netlify-db-"));
  db = new NetlifyDB({ directory, logger: () => undefined });
  vi.stubEnv("NETLIFY_DB_URL", await db.start());
  vi.stubEnv("NETLIFY_DB_DRIVER", "server");
  vi.stubEnv("NETLIFY", "true");
});
afterAll(async () => {
  await db?.stop();
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it("aplica as migrações com o runner oficial, sem Docker, de forma repetível", async () => {
  expect(
    await db.applyMigrations(
      join(process.cwd(), "netlify/database/migrations"),
    ),
  ).toEqual([
    "001_crm",
    "002_snapshot",
    "003_crm_v2",
    "004_whatsapp_foundation",
    "005_chat_import_audit",
  ]);
  expect(
    await db.applyMigrations(
      join(process.cwd(), "netlify/database/migrations"),
    ),
  ).toEqual([]);
  const pool = getPool();
  try {
    expect(
      (await new PostgresCrmRepository(pool).load()).data.pipelines,
    ).toHaveLength(1);
  } finally {
    await releaseRequestPool(pool);
  }
});
it("usa o SDK oficial e persiste um movimento em uma etapa vazia", async () => {
  const pool = getPool();
  try {
    const repo = new PostgresCrmRepository(pool),
      initial = await repo.load();
    const seeded = await repo.save({
      data: createSeedData(),
      baseRevision: initial.revision,
      requestId: randomUUID(),
      operation: "import",
    });
    await repo.save({
      data: moveDeal(seeded.data, "deal-0", "partner-meeting"),
      baseRevision: seeded.revision,
      requestId: randomUUID(),
      operation: "change",
    });
  } finally {
    await releaseRequestPool(pool);
  }
});
it("impede misturar o runner legado com migrações oficiais já aplicadas", async () => {
  const pool = getPool();
  try {
    await expect(migrate(pool)).rejects.toThrow(
      "NETLIFY_MIGRATIONS_USE_OFFICIAL_RUNNER",
    );
  } finally {
    await releaseRequestPool(pool);
  }
});
it("salva configurações, regras e agenda com o SDK oficial", async () => {
  const pool = getPool();
  try {
    const repo = new PostgresCrmRepository(pool),
      base = await repo.load();
    let data = saveCatalog(base.data, "businessTypes", "Construção fictícia");
    data = saveCatalog(data, "sources", "Tráfego fictício");
    data = saveCatalog(data, "sellers", "Paula fictícia");
    data = saveDistributionRule(data, {
      name: "Distribuição persistida",
      businessTypeId: data.businessTypes[0].id,
      source: "Tráfego fictício",
      pipelineId: "pipeline-partners",
      enabled: true,
      isDefault: false,
    });
    data = saveScheduledActivity(data, {
      title: "Agenda persistida",
      type: "call",
      dueAt: "2027-01-02T12:00:00.000Z",
      dealId: "deal-0",
      customerId: "customer-0",
      owner: "Paula fictícia",
      notes: "",
      remindBeforeMinutes: 15,
    });
    await repo.save({
      data,
      baseRevision: base.revision,
      requestId: randomUUID(),
      operation: "change",
    });
  } finally {
    await releaseRequestPool(pool);
  }
});
it("recupera os dados após parar e reabrir o Netlify Database local", async () => {
  await db.stop();
  db = new NetlifyDB({ directory, logger: () => undefined });
  vi.stubEnv("NETLIFY_DB_URL", await db.start());
  const pool = getPool();
  try {
    const state = await new PostgresCrmRepository(pool).load();
    expect(state.data.deals.find((d) => d.id === "deal-0")).toMatchObject({
      stageId: "partner-meeting",
      pipelineId: "pipeline-partners",
    });
    expect(state.data.businessTypes[0].name).toBe("Construção fictícia");
    expect(state.data.distributionRules[0].name).toBe(
      "Distribuição persistida",
    );
    expect(state.data.scheduledActivities[0].title).toBe("Agenda persistida");
    expect(state.data.sellers.some((s) => s.name === "Paula fictícia")).toBe(
      true,
    );
    expect(
      await new PostgresCrmRepository(pool).loadIfChanged(state.revision),
    ).toBeNull();
  } finally {
    await releaseRequestPool(pool);
  }
});
