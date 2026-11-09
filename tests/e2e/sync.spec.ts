import { test, expect } from "@playwright/test";
import { request as rawRequest } from "node:http";
import { createSeedData } from "../../src/lib/seed";
import { legacyBackup } from "../legacy-backup";

test.beforeEach(async ({ request, baseURL }) => {
  if (
    process.env.CRM_E2E_ALLOW_RESET !== "true" ||
    !["127.0.0.1", "localhost"].includes(new URL(baseURL!).hostname)
  )
    throw new Error("Use um servidor local e um banco exclusivo de testes.");
  const current = await (await request.get("/api/crm")).json();
  const response = await request.put("/api/crm", {
    headers: { origin: new URL(baseURL!).origin },
    data: {
      data: createSeedData(),
      baseRevision: current.revision,
      requestId: crypto.randomUUID(),
      operation: "import",
    },
  });
  expect(response.status()).toBe(200);
});

test("sincroniza dois dispositivos e impede salvar um formulário antigo sobre alterações remotas", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  await page.goto("/");
  const context = await browser.newContext({
    baseURL,
  });
  try {
    const second = await context.newPage();
    await second.clock.install();
    await second.goto("/");
    await second.getByTestId("deal-deal-0").click();
    await second.getByLabel("Valor (R$)").fill("999");
    await page.getByTestId("deal-deal-0").click();
    await page
      .getByLabel("Anotações")
      .fill("Contrato atualizado no dispositivo A");
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await second.clock.fastForward(35_000);
    await expect(
      second.getByText("Dados atualizados por outro dispositivo.", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 10000 });
    await second
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(
      second.getByText("Este formulário ficou desatualizado.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(second.getByRole("dialog")).toBeVisible();
    const state = await (await request.get("/api/crm")).json();
    expect(
      state.data.deals.find((d: { id: string }) => d.id === "deal-0"),
    ).toMatchObject({
      notes: "Contrato atualizado no dispositivo A",
      value: 8500,
    });
    await second.getByRole("button", { name: "Cancelar", exact: true }).click();
    await second.getByTestId("deal-deal-0").click();
    await expect(second.getByLabel("Anotações")).toHaveValue(
      "Contrato atualizado no dispositivo A",
    );
  } finally {
    await context.close();
  }
});

test("API permite demonstração pública, exige origem válida e rejeita conflitos sem perder dados", async ({
  request,
  baseURL,
}) => {
  for (const method of ["GET", "PUT"]) {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const raw = rawRequest(
        new URL("/api/crm", baseURL),
        { method },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode));
        },
      );
      raw.on("error", reject);
      raw.end();
    });
    expect(status).toBe(method === "GET" ? 200 : 403);
  }
  const state = await (await request.get("/api/crm")).json();
  const payload = {
    data: state.data,
    baseRevision: state.revision,
    requestId: crypto.randomUUID(),
    operation: "change",
  };
  expect(
    (
      await request.put("/api/crm", {
        headers: { origin: "https://untrusted.example" },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  const response = await request.put("/api/crm", {
    headers: { origin: new URL(baseURL!).origin },
    data: payload,
  });
  expect(response.status()).toBe(200);
  expect(
    (
      await request.put("/api/crm", {
        headers: { origin: new URL(baseURL!).origin },
        data: payload,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.put("/api/crm", {
        headers: { origin: new URL(baseURL!).origin },
        data: { ...payload, requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(409);
  expect(
    (await (await request.get("/api/crm/history")).json()).history.length,
  ).toBeGreaterThan(0);
});

test("falha de gravação não vira sucesso nem descarta o formulário", async ({
  page,
  request,
}) => {
  const before = await (await request.get("/api/crm")).json();
  await page.goto("/");
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page.getByLabel("Nome do contato").fill("Cliente fictício pendente");
  await page.route("**/api/crm", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Banco indisponível para teste." }),
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Cadastrar cliente", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Cadastrar cliente" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome do contato")).toHaveValue(
    "Cliente fictício pendente",
  );
  await expect(
    page.getByText("Banco indisponível para teste.").first(),
  ).toBeVisible();
  const after = await (await request.get("/api/crm")).json();
  expect(after.revision).toBe(before.revision);
  expect(after.data.customers).toHaveLength(10);
});

test("importa backup JSON v1 preservando funis personalizados e registra auditoria", async ({
  page,
  request,
}) => {
  const legacy = legacyBackup();
  legacy.pipelines[0].name = "Funil personalizado importado";
  legacy.pipelines[0].stages[0].name = "Etapa legada";
  await page.goto("/");
  await page
    .getByRole("button", { name: "Menu do espaço de trabalho" })
    .click();
  await page.getByRole("menuitem", { name: "Importar backup" }).click();
  await page.getByLabel("Importar backup JSON").setInputFiles({
    name: "backup-v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await page
    .getByRole("button", { name: "Restaurar backup", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Selecionar funil: Funil personalizado importado",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Etapa legada", exact: true }),
  ).toBeVisible();
  const state = await (await request.get("/api/crm")).json();
  expect(state.data.deals).toHaveLength(12);
  const history = await (await request.get("/api/crm/history")).json();
  expect(history.history[0].operation).toBe("import");
});
