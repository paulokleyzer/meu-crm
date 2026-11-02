// Invoke the actual output of the official Next.js adapter, against a fresh
// local Netlify Database. This never accesses a hosted site or a real database.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { NetlifyDB } from "@netlify/database-dev";

const root = process.cwd();
const fixture = resolve(process.argv[2]);
const directory = await mkdtemp(join(tmpdir(), "crm-function-db-"));
const database = new NetlifyDB({ directory, logger: () => undefined });
const functionRoot = join(
  fixture,
  ".netlify/functions-internal/___netlify-server-handler",
);
const origin = "https://crm-fictional-validation.netlify.app";
const password = randomBytes(32).toString("hex");
try {
  process.env.NETLIFY_DB_URL = await database.start();
  process.env.NETLIFY_DB_DRIVER = "server";
  process.env.NETLIFY = "true";
  process.env.CRM_ACCESS_MODE = "basic";
  process.env.CRM_BASIC_USER = "fictional-validation";
  process.env.CRM_BASIC_PASSWORD = password;
  process.env.CRM_ALLOWED_ORIGIN = origin;
  // Dynamic API routes still initialize the adapter's cache. Supply local-only
  // metadata; no hosted Blobs endpoint or credential is available to this test.
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
    JSON.stringify({
      deployID: "localtest",
      siteID: "localtest",
      token: "fictional-local-only",
      apiURL: "http://127.0.0.1:1",
      primaryRegion: "us-east-2",
    }),
  ).toString("base64");
  // No native fallback can hide a broken SDK integration.
  delete process.env.DATABASE_URL;
  await database.applyMigrations(join(root, "netlify/database/migrations"));
  process.chdir(functionRoot);
  const { default: handler } = await import(
    pathToFileURL(join(functionRoot, "___netlify-server-handler.mjs")).href
  );
  const headers = {
    authorization:
      "Basic " +
      Buffer.from("fictional-validation:" + password).toString("base64"),
    origin,
    "content-type": "application/json",
  };
  async function invoke(path, options = {}) {
    return handler(new Request(origin + path, { headers, ...options }), {
      account: { id: "local-test" },
      deploy: { id: "local-test" },
      site: { id: "local-test", url: origin },
      requestId: randomUUID(),
      waitUntil: () => undefined,
    });
  }
  const denied = await invoke("/api/crm", { headers: {} });
  assert.equal(denied.status, 401);
  process.env.CRM_ACCESS_MODE = "demo";
  delete headers.authorization;
  const anonymous = await invoke("/api/crm", { headers: {} });
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.headers.has("www-authenticate"), false);
  const originDenied = await invoke("/api/crm", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(originDenied.status, 403);
  const initialResponse = await invoke("/api/crm");
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json();
  initial.data.customers.push({
    id: "fictional-function-customer",
    name: "Cliente fictício da função",
    company: "Empresa fictícia",
    email: "function@example.com",
    phone: "",
    createdAt: new Date().toISOString(),
  });
  initial.data.businessTypes.push({
    id: "function-type",
    name: "Tipo fictício da função",
  });
  initial.data.sources.push({
    id: "function-source",
    name: "Origem fictícia da função",
  });
  initial.data.sellers.push({
    id: "function-seller",
    name: "Responsável fictício",
    active: true,
  });
  initial.data.distributionRules.push({
    id: "function-rule",
    name: "Regra fictícia",
    businessTypeId: "function-type",
    source: "Origem fictícia da função",
    pipelineId: initial.data.pipelines[0].id,
    enabled: true,
    isDefault: false,
  });
  initial.data.deals.push({
    id: "function-deal",
    title: "Oportunidade fictícia da função",
    value: 100,
    customerId: "fictional-function-customer",
    pipelineId: initial.data.pipelines[0].id,
    stageId: initial.data.pipelines[0].stages[0].id,
    businessTypeId: "function-type",
    source: "Origem fictícia da função",
    owner: "Responsável fictício",
    status: "open",
    priority: "medium",
    expectedCloseDate: "",
    notes: "",
    position: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  initial.data.scheduledActivities.push({
    id: "function-task",
    title: "Atividade fictícia da função",
    type: "meeting",
    dueAt: "2027-01-02T12:00:00.000Z",
    customerId: "fictional-function-customer",
    dealId: "function-deal",
    owner: "Responsável fictício",
    completedAt: "",
    remindBeforeMinutes: 15,
    notes: "",
    createdAt: new Date().toISOString(),
  });
  const saved = await invoke("/api/crm", {
    method: "PUT",
    body: JSON.stringify({
      data: initial.data,
      baseRevision: initial.revision,
      requestId: randomUUID(),
      operation: "change",
    }),
  });
  assert.equal(saved.status, 200);
  const confirmed = await saved.json();
  const reloaded = await (await invoke("/api/crm")).json();
  assert.equal(reloaded.revision, confirmed.revision);
  assert.equal(reloaded.data.customers[0].name, "Cliente fictício da função");
  const unchanged = await invoke("/api/crm", {
    headers: {
      ...headers,
      "if-none-match": `"revision-${confirmed.revision}"`,
    },
  });
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), "");
  const sql = await database.query(
    "SELECT name FROM crm_customers WHERE id=$1",
    ["fictional-function-customer"],
  );
  assert.equal(sql.rows[0].name, "Cliente fictício da função");
  assert.equal(reloaded.data.distributionRules[0].name, "Regra fictícia");
  assert.equal(
    reloaded.data.scheduledActivities[0].title,
    "Atividade fictícia da função",
  );
  assert.equal(
    (
      await database.query(
        "SELECT business_type_id FROM crm_deals WHERE id='function-deal'",
      )
    ).rows[0].business_type_id,
    "function-type",
  );
  assert.equal(
    (
      await database.query(
        "SELECT type FROM crm_scheduled_activities WHERE id='function-task'",
      )
    ).rows[0].type,
    "meeting",
  );
  await database.query(
    "INSERT INTO crm_demo_limits(bucket,window_start,hits) VALUES ('write:global',now(),600) ON CONFLICT(bucket) DO UPDATE SET hits=600,window_start=now()",
  );
  const limited = await invoke("/api/crm", { method: "PUT", body: "{}" });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  console.log(
    "Função empacotada: modo Basic opcional, demonstração sem senha, origem obrigatória, CRUD v2, recuperação SQL, limite 429 e 304 validados com o SDK oficial.",
  );
} catch (error) {
  // Next installs an uncaughtException handler; a failed assertion must still
  // explicitly fail this command instead of accidentally exiting zero.
  process.exitCode = 1;
  console.error("Falha na validação da função empacotada:", error);
} finally {
  process.chdir(root);
  await database.stop();
  await rm(directory, { recursive: true, force: true });
}
