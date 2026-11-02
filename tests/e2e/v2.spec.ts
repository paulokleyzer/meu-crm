import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createSeedData } from "../../src/lib/seed";
import { saveCatalog, saveDistributionRule } from "../../src/lib/crm-v2";
import type { CrmData } from "../../src/lib/types";

test.beforeEach(async ({ request, baseURL }) => {
  if (
    process.env.CRM_E2E_ALLOW_RESET !== "true" ||
    !["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname)
  )
    throw new Error("Somente banco fictício em loopback.");
  const current = await (await request.get("/api/crm")).json();
  expect(
    (
      await request.put("/api/crm", {
        headers: { origin: new URL(baseURL!).origin },
        data: {
          data: createSeedData(),
          baseRevision: current.revision,
          requestId: crypto.randomUUID(),
          operation: "import",
        },
      })
    ).status(),
  ).toBe(200);
});
async function settings(page: Page, tab: string) {
  await page
    .getByRole("button", { name: "Configurações", exact: true })
    .click();
  await page.getByRole("button", { name: tab, exact: true }).click();
}
async function addCatalog(
  page: Page,
  tab: string,
  button: string,
  label: string,
  name: string,
) {
  await settings(page, tab);
  await page.getByRole("button", { name: button, exact: true }).click();
  await page.getByLabel(label, { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
function typedData() {
  let data = saveCatalog(
    createSeedData(),
    "businessTypes",
    "Motos elétricas de teste",
  );
  data = saveCatalog(data, "sources", "Tráfego pago de teste");
  return data;
}
async function seedData(
  request: APIRequestContext,
  baseURL: string,
  data: CrmData,
) {
  const current = await (await request.get("/api/crm")).json();
  expect(
    (
      await request.put("/api/crm", {
        headers: { origin: new URL(baseURL).origin },
        data: {
          data,
          baseRevision: current.revision,
          requestId: crypto.randomUUID(),
          operation: "import",
        },
      })
    ).status(),
  ).toBe(200);
}

test("demonstração abre sem senha e cadastra cliente com link internacional do WhatsApp", async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const anonymous = await browser.newContext({ baseURL });
  try {
    const response = await anonymous.request.get("/api/crm");
    expect(response.status()).toBe(200);
    expect(response.headers()["www-authenticate"]).toBeUndefined();
  } finally {
    await anonymous.close();
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await page.getByLabel("Nome do contato").fill("Cliente demo sem senha");
  await page.getByLabel("Telefone", { exact: true }).fill("(11) 99910-2040");
  await page
    .getByRole("button", { name: "Cadastrar cliente", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: "Conversar no WhatsApp com Cliente demo sem senha",
    }),
  ).toHaveAttribute("href", "https://wa.me/5511999102040");
  await page.reload();
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Editar cliente Cliente demo sem senha" }),
  ).toBeVisible();
  expect(
    (await (await request.get("/api/crm")).json()).data.customers.some(
      (c: { name: string }) => c.name === "Cliente demo sem senha",
    ),
  ).toBe(true);
});

test("cria, renomeia e remove categorias e origens, e configura responsáveis persistidos", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await addCatalog(
    page,
    "Tipos de negócio",
    "Adicionar tipo de negócio",
    "Nome do tipo de negócio",
    "Energia solar de teste",
  );
  await page
    .getByRole("button", { name: "Editar Energia solar de teste", exact: true })
    .click();
  await page
    .getByLabel("Nome do tipo de negócio")
    .fill("Energia personalizada");
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await addCatalog(
    page,
    "Origens comerciais",
    "Adicionar origem comercial",
    "Nome da origem comercial",
    "Indicação personalizada",
  );
  await page
    .getByRole("button", {
      name: "Editar Indicação personalizada",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Nome da origem comercial")
    .fill("Campanha personalizada");
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await addCatalog(
    page,
    "Responsáveis",
    "Adicionar responsável",
    "Nome do responsável",
    "Vendedor configurável",
  );
  const seller = page
    .locator(".settings-row")
    .filter({ has: page.getByText("Vendedor configurável", { exact: true }) });
  await seller.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(seller.getByText("Inativo", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await settings(page, "Responsáveis");
  await expect(
    page.getByText("Vendedor configurável", { exact: true }),
  ).toBeVisible();
  await settings(page, "Origens comerciais");
  await page
    .getByRole("button", {
      name: "Excluir Campanha personalizada",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await settings(page, "Tipos de negócio");
  await page
    .getByRole("button", { name: "Excluir Energia personalizada", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const stored = (await (await request.get("/api/crm")).json()).data;
  expect(stored.businessTypes).toHaveLength(0);
  expect(
    stored.sources.some(
      (s: { name: string }) => s.name === "Campanha personalizada",
    ),
  ).toBe(false);
  expect(
    stored.sellers.find(
      (s: { name: string }) => s.name === "Vendedor configurável",
    ).active,
  ).toBe(false);
});

test("cria regra pela interface, simula contato e permite mudar o destino manualmente", async ({
  page,
  request,
  baseURL,
}) => {
  const data = typedData();
  await seedData(request, baseURL!, data);
  await page.goto("/");
  await settings(page, "Regras de distribuição");
  await page.getByRole("button", { name: "Nova regra", exact: true }).click();
  await page.getByLabel("Nome da regra").fill("Motos por campanha");
  await page
    .getByLabel("Se tipo de negócio")
    .selectOption(data.businessTypes[0].id);
  await page
    .getByLabel("E origem comercial")
    .selectOption("Tráfego pago de teste");
  await page
    .getByLabel("Então enviar para o funil")
    .selectOption("pipeline-partners");
  await page.getByRole("button", { name: "Salvar regra", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Simulador", exact: true }).click();
  await page.getByLabel("Nome fictício do contato").fill("Contato de campanha");
  await page
    .getByLabel("Tipo para simular")
    .selectOption(data.businessTypes[0].id);
  await page
    .getByLabel("Origem para simular")
    .selectOption("Tráfego pago de teste");
  await expect(
    page.getByRole("status").filter({ hasText: "Regra: Motos por campanha" }),
  ).toContainText("Parcerias → Primeiro contato");
  await page
    .getByRole("button", { name: "Criar oportunidade fictícia", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/crm")).json()).data.deals.length,
    )
    .toBe(13);
  let stored = (await (await request.get("/api/crm")).json()).data;
  const created = stored.deals.find(
    (d: { title: string }) => d.title === "Simulação · Contato de campanha",
  );
  expect(created).toMatchObject({
    pipelineId: "pipeline-partners",
    stageId: "partner-contact",
    source: "Tráfego pago de teste",
    businessTypeId: data.businessTypes[0].id,
  });
  await page.getByRole("button", { name: "Funis", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar funil:" }).click();
  await page.getByRole("menuitem", { name: "Parcerias", exact: true }).click();
  await page.getByTestId(`deal-${created.id}`).click();
  await page.getByLabel("Modo de distribuição").selectOption("manual");
  await page
    .getByLabel("Funil", { exact: true })
    .selectOption("pipeline-sales");
  await page
    .getByLabel("Etapa", { exact: true })
    .selectOption("stage-qualified");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  stored = (await (await request.get("/api/crm")).json()).data;
  expect(
    stored.deals.find((d: { id: string }) => d.id === created.id).stageId,
  ).toBe("stage-qualified");
});

test("aplica regras na criação manual, filtra por tipo e origem e mostra resultados no dashboard", async ({
  page,
  request,
  baseURL,
}) => {
  let data = typedData();
  data = saveDistributionRule(data, {
    name: "Motos automáticas",
    businessTypeId: data.businessTypes[0].id,
    source: "Tráfego pago de teste",
    pipelineId: "pipeline-partners",
    enabled: true,
    isDefault: false,
  });
  await seedData(request, baseURL!, data);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Nova oportunidade", exact: true })
    .click();
  await page
    .getByLabel("Título da oportunidade")
    .fill("Negócio automático de teste");
  await page.getByLabel("Valor (R$)").fill("1234.56");
  await page.getByLabel("Cliente", { exact: false }).selectOption("customer-0");
  await page
    .getByLabel("Tipo de negócio", { exact: true })
    .selectOption(data.businessTypes[0].id);
  await page
    .getByLabel("Origem", { exact: true })
    .selectOption("Tráfego pago de teste");
  await page.getByLabel("Modo de distribuição").selectOption("automatic");
  await page
    .getByRole("button", { name: "Criar oportunidade", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Selecionar funil: Parcerias",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByLabel("Tipo de negócio", { exact: true })
    .selectOption(data.businessTypes[0].id);
  await page
    .getByLabel("Origem comercial", { exact: true })
    .selectOption("Tráfego pago de teste");
  await expect(page.locator(".deal-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  for (const title of [
    "Conversão por funil",
    "Resultados por origem",
    "Resultados por tipo de negócio",
    "Resultados por responsável",
  ])
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  const table = page.locator(".insights-panel").filter({
    has: page.getByRole("heading", {
      name: "Resultados por tipo de negócio",
      exact: true,
    }),
  });
  await expect(
    table.getByRole("row").filter({ hasText: "Motos elétricas de teste" }),
  ).toContainText("1.234,56");
});

test("prioriza, desativa e usa regra padrão sem alterar oportunidades existentes", async ({
  page,
  request,
  baseURL,
}) => {
  let data = typedData();
  data = saveDistributionRule(data, {
    name: "Primeira",
    businessTypeId: "",
    source: "",
    pipelineId: "pipeline-sales",
    enabled: true,
    isDefault: false,
  });
  data = saveDistributionRule(data, {
    name: "Segunda",
    businessTypeId: "",
    source: "",
    pipelineId: "pipeline-partners",
    enabled: true,
    isDefault: false,
  });
  data = saveDistributionRule(data, {
    name: "Padrão",
    businessTypeId: "",
    source: "",
    pipelineId: "pipeline-sales",
    enabled: true,
    isDefault: true,
  });
  await seedData(request, baseURL!, data);
  await page.goto("/");
  await settings(page, "Regras de distribuição");
  await page
    .getByRole("button", { name: "Subir regra Segunda", exact: true })
    .click();
  await expect(page.locator(".rule-row").first()).toContainText("Segunda");
  await page.getByRole("button", { name: "Simulador", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Regra: Segunda" }),
  ).toContainText("Parcerias");
  await settings(page, "Regras de distribuição");
  for (const name of ["Primeira", "Segunda"]) {
    const row = page
      .locator(".rule-row")
      .filter({ has: page.getByText(new RegExp(`\\d+\\. ${name}$`)) });
    await row.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect(row.getByText("Inativa", { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Simulador", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Regra: Padrão" }),
  ).toContainText("Funil de vendas");
  expect(
    (await (await request.get("/api/crm")).json()).data.deals,
  ).toHaveLength(12);
});

test("agenda ligação, sinaliza atraso no cartão, conclui, reabre e edita a data", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByTestId("deal-deal-0").click();
  await page
    .getByRole("button", { name: "Agendar atividade", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Nova atividade",
    exact: true,
  });
  await modal
    .getByLabel("Título da atividade")
    .fill("Ligação atrasada de teste");
  await modal.getByLabel("Tipo de atividade").selectOption("call");
  await modal.getByLabel("Data e horário").fill("2020-01-01T10:00");
  await modal
    .getByRole("button", { name: "Salvar atividade", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page
      .getByTestId("deal-deal-0")
      .getByText("Atividade atrasada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Atividades", exact: true }).click();
  const row = page
    .locator(".agenda-row")
    .filter({ hasText: "Ligação atrasada de teste" });
  await expect(row).toContainText("Atividade atrasada");
  await row.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByLabel("Visualizar atividades").selectOption("completed");
  await expect(row).toContainText("Concluída");
  await row.getByRole("button", { name: "Reabrir", exact: true }).click();
  await page.getByLabel("Visualizar atividades").selectOption("pending");
  await row
    .getByRole("button", {
      name: "Editar atividade Ligação atrasada de teste",
      exact: true,
    })
    .click();
  await page.getByLabel("Data e horário").fill("2099-01-01T10:00");
  await page.getByLabel("Notas da atividade").fill("Reagendada pelo teste");
  await page
    .getByRole("button", { name: "Salvar atividade", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Visualizar atividades").selectOption("upcoming");
  await expect(row).toContainText("Reagendada pelo teste");
  await page.reload();
  await page.getByRole("button", { name: "Atividades", exact: true }).click();
  await expect(row).toContainText("Reagendada pelo teste");
  const stored = (await (await request.get("/api/crm")).json()).data;
  expect(stored.scheduledActivities[0]).toMatchObject({
    customerId: "customer-0",
    dealId: "deal-0",
    type: "call",
    completedAt: "",
  });
  expect(stored.deals).toHaveLength(12);
});

for (const [type, label] of [
  ["task", "Tarefa"],
  ["meeting", "Reunião"],
  ["follow_up", "Retorno comercial"],
] as const) {
  test(`agenda ${label.toLowerCase()} para um cliente e permite excluir sem apagar o cliente`, async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Atividades", exact: true }).click();
    await page
      .getByRole("button", { name: "Nova atividade", exact: true })
      .click();
    await page.getByLabel("Título da atividade").fill(`${label} de teste`);
    await page.getByLabel("Tipo de atividade").selectOption(type);
    await page.getByLabel("Cliente da atividade").selectOption("customer-0");
    await page.getByLabel("Data e horário").fill("2099-02-03T14:30");
    await page
      .getByRole("button", { name: "Salvar atividade", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const row = page
      .locator(".agenda-row")
      .filter({ hasText: `${label} de teste` });
    await expect(row).toContainText("Ana Oliveira");
    await row
      .getByRole("button", {
        name: `Excluir atividade ${label} de teste`,
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Excluir atividade", exact: true })
      .click();
    await expect(row).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const state = (await (await request.get("/api/crm")).json()).data;
    expect(state.customers).toHaveLength(10);
    expect(state.scheduledActivities).toHaveLength(0);
  });
}

test("arrasta um cartão para outro funil com dnd-kit e persiste ao recarregar", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const card = page.getByTestId("deal-deal-0"),
    from = (await card.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 12,
    from.y + from.height / 2,
    { steps: 3 },
  );
  const target = page.getByTestId("pipeline-drop-pipeline-partners");
  await expect(target).toBeVisible();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 25,
  });
  await page.mouse.up();
  await expect(card).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/crm")).json()).data.deals.find(
          (d: { id: string }) => d.id === "deal-0",
        ).pipelineId,
    )
    .toBe("pipeline-partners");
  await page.reload();
  await page.getByRole("button", { name: "Selecionar funil:" }).click();
  await page.getByRole("menuitem", { name: "Parcerias", exact: true }).click();
  await expect(
    page.getByTestId("stage-partner-contact").getByTestId("deal-deal-0"),
  ).toBeVisible();
});

test("novas configurações e atividades continuam acessíveis no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await settings(page, "Regras de distribuição");
  await expect(
    page.getByRole("button", { name: "Nova regra", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Atividades", exact: true }).click();
  await page
    .getByRole("button", { name: "Nova atividade", exact: true })
    .click();
  await expect(page.getByLabel("Título da atividade")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("novas telas e formulários atendem à acessibilidade básica", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settings(page, "Tipos de negócio");
  expect(
    (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
  await page.getByRole("button", { name: "Atividades", exact: true }).click();
  await page
    .getByRole("button", { name: "Nova atividade", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
});

test("configura, edita e exclui uma regra padrão pela interface", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await settings(page, "Regras de distribuição");
  await page.getByRole("button", { name: "Nova regra", exact: true }).click();
  await page.getByLabel("Nome da regra").fill("Padrão configurável");
  await page.getByLabel("Usar como regra padrão").check();
  await page
    .getByLabel("Então enviar para o funil")
    .selectOption("pipeline-partners");
  await page.getByRole("button", { name: "Salvar regra", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Editar regra Padrão configurável",
      exact: true,
    })
    .click();
  await page.getByLabel("Nome da regra").fill("Padrão renomeado");
  await page.getByRole("button", { name: "Salvar regra", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Simulador", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Regra: Padrão renomeado" }),
  ).toContainText("Parcerias → Primeiro contato");
  await settings(page, "Regras de distribuição");
  await page
    .getByRole("button", {
      name: "Excluir regra Padrão renomeado",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Excluir regra", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await (await request.get("/api/crm")).json()).data.distributionRules,
  ).toHaveLength(0);
});

test("sincroniza agenda e responsáveis entre dispositivos e protege um formulário antigo", async ({
  page,
  browser,
  baseURL,
}) => {
  const secondContext = await browser.newContext({ baseURL });
  try {
    const second = await secondContext.newPage();
    await second.clock.install();
    await second.goto("/");
    await second
      .getByRole("button", { name: "Atividades", exact: true })
      .click();
    await page.goto("/");
    await page.getByRole("button", { name: "Atividades", exact: true }).click();
    await page
      .getByRole("button", { name: "Nova atividade", exact: true })
      .click();
    await page
      .getByLabel("Título da atividade")
      .fill("Agenda entre dispositivos");
    await page.getByLabel("Cliente da atividade").selectOption("customer-0");
    await page
      .getByLabel("Responsável da atividade")
      .selectOption("Paulo Kleyzer");
    await page.getByLabel("Data e horário").fill("2099-01-02T12:00");
    await page
      .getByRole("button", { name: "Salvar atividade", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await second.clock.fastForward(35000);
    await expect(
      second.getByRole("heading", {
        name: "Agenda entre dispositivos",
        exact: true,
      }),
    ).toBeVisible();
    await second
      .getByRole("button", {
        name: "Editar atividade Agenda entre dispositivos",
        exact: true,
      })
      .click();
    await second
      .getByLabel("Notas da atividade")
      .fill("Texto local ainda não salvo");
    await settings(page, "Responsáveis");
    await page
      .getByRole("button", { name: "Editar Paulo Kleyzer", exact: true })
      .click();
    await page
      .getByLabel("Nome do responsável")
      .fill("Responsável atualizado remoto");
    await page
      .getByRole("button", { name: "Salvar cadastro", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await second.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(second.getByLabel("Responsável da atividade")).toContainText(
      "Responsável atualizado remoto",
    );
    await second
      .getByRole("button", { name: "Salvar atividade", exact: true })
      .click();
    await expect(
      second.getByText("Este formulário ficou desatualizado.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(second.getByRole("dialog")).toBeVisible();
  } finally {
    await secondContext.close();
  }
});

test("mostra lembrete interno e rejeita atualização de cliente antigo ou corpo excessivo", async ({
  page,
  request,
  baseURL,
}) => {
  const state = await (await request.get("/api/crm")).json();
  state.data.scheduledActivities.push({
    id: "test-reminder",
    title: "Retorno em cinco minutos",
    type: "follow_up",
    customerId: "customer-0",
    dealId: "deal-0",
    owner: state.data.sellers[0].name,
    notes: "",
    completedAt: "",
    createdAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    remindBeforeMinutes: 15,
  });
  await seedData(request, baseURL!, state.data);
  await page.goto("/");
  await page.getByRole("button", { name: "Atividades", exact: true }).click();
  await expect(
    page.locator(".agenda-row").filter({ hasText: "Retorno em cinco minutos" }),
  ).toContainText("Lembrete: está chegando");
  const origin = new URL(baseURL!).origin;
  expect(
    (
      await request.put("/api/crm", {
        headers: { origin },
        data: {
          data: { schemaVersion: 1 },
          baseRevision: state.revision,
          requestId: crypto.randomUUID(),
          operation: "change",
        },
      })
    ).status(),
  ).toBe(426);
  expect(
    (
      await request.put("/api/crm", {
        headers: { origin, "content-type": "application/json" },
        data: " ".repeat(4 * 1024 * 1024 + 1),
      })
    ).status(),
  ).toBe(413);
});
