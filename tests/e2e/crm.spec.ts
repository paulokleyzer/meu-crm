import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createSeedData } from "../../src/lib/seed";

const KEY = "meu-crm:data:v1";

test.beforeEach(async ({ page, request, baseURL }) => {
  if (
    process.env.CRM_E2E_ALLOW_RESET !== "true" ||
    !["localhost", "127.0.0.1"].includes(new URL(baseURL!).hostname)
  )
    throw new Error(
      "E2E exige CRM_E2E_ALLOW_RESET=true em servidor local com dados fictícios.",
    );
  const state = await (await request.get("/api/crm")).json();
  const response = await request.put("/api/crm", {
    headers: { origin: new URL(baseURL!).origin },
    data: {
      data: createSeedData(),
      baseRevision: state.revision,
      requestId: crypto.randomUUID(),
      operation: "import",
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Oportunidades" }),
  ).toBeVisible();
});

async function drag(
  page: Page,
  source: Locator,
  target: Locator,
  bottom = false,
) {
  await target.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Cartão ou destino fora do quadro");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 10,
    from.y + from.height / 2,
    { steps: 3 },
  );
  const viewport = page.viewportSize()!;
  const targetY = Math.min(
    viewport.height - 60,
    to.y + (bottom ? to.height - 40 : to.height / 2),
  );
  await page.mouse.move(to.x + to.width / 2, targetY, { steps: 20 });
  await page.mouse.up();
}

test("move cartões entre etapas com o mouse e persiste após recarregar", async ({
  page,
}) => {
  const source = page.getByTestId("deal-deal-0");
  const column = page.getByTestId("stage-stage-qualified");
  await drag(page, source, page.getByTestId("dropzone-stage-qualified"), true);
  await expect(column.getByTestId("deal-deal-0")).toBeVisible();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(column.getByTestId("deal-deal-0")).toBeVisible();
  await column.getByTestId("deal-deal-0").click();
  await expect(page.getByLabel("Etapa", { exact: true })).toHaveValue(
    "stage-qualified",
  );
});

test("aceita arrastar para uma coluna completamente vazia", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Selecionar funil:" }).click();
  await page.getByRole("menuitem", { name: "Parcerias", exact: true }).click();
  const empty = page.getByTestId("stage-partner-meeting");
  await expect(empty.getByText("Arraste uma oportunidade")).toBeVisible();
  await drag(
    page,
    page.getByTestId("deal-deal-partner"),
    page.getByTestId("dropzone-partner-meeting"),
  );
  await expect(empty.getByTestId("deal-deal-partner")).toBeVisible();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Selecionar funil:" }).click();
  await page.getByRole("menuitem", { name: "Parcerias", exact: true }).click();
  await expect(empty.getByTestId("deal-deal-partner")).toBeVisible();
});

test("reordena cartões e permite movimentação por teclado", async ({
  page,
}) => {
  const column = page.getByTestId("stage-stage-lead");
  await drag(
    page,
    page.getByTestId("deal-deal-2"),
    page.getByTestId("deal-deal-0"),
  );
  await expect(column.locator(".deal-card").first()).toHaveAttribute(
    "data-testid",
    "deal-deal-2",
  );
  const card = page.getByTestId("deal-deal-2");
  await card.focus();
  await page.keyboard.press("Space");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("status")).toContainText("Qualificação");
  await page.keyboard.press("Space");
  await expect(
    page.getByTestId("stage-stage-qualified").getByTestId("deal-deal-2"),
  ).toBeVisible();
});

test("cadastra cliente dentro de uma oportunidade e edita seus detalhes", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Nova oportunidade", exact: true })
    .click();
  await page
    .getByLabel("Título da oportunidade")
    .fill("Contrato de implantação");
  await page.getByLabel("Valor (R$)").fill("14990.50");
  await page
    .getByRole("button", { name: "Cadastrar cliente", exact: true })
    .click();
  const customerDialog = page.getByRole("dialog", {
    name: "Cadastrar cliente",
  });
  await customerDialog.getByLabel("Nome do contato").fill("Carolina Teste");
  await customerDialog
    .getByLabel("Empresa", { exact: true })
    .fill("Empresa de teste");
  await customerDialog
    .getByLabel("E-mail", { exact: true })
    .fill("carolina@example.com");
  await customerDialog
    .getByRole("button", { name: "Cadastrar cliente", exact: true })
    .click();
  await page.getByLabel("Prioridade", { exact: true }).selectOption("high");
  await page
    .getByLabel("Anotações")
    .fill("Apresentar proposta na sexta-feira.");
  await page
    .getByRole("button", { name: "Criar oportunidade", exact: true })
    .click();
  const card = page.getByRole("button", {
    name: "Abrir oportunidade Contrato de implantação",
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(card).toContainText("14.990,50");
  await card.click();
  await expect(page.getByLabel("Cliente", { exact: false })).toContainText(
    "Carolina Teste",
  );
  await page.getByLabel("Título da oportunidade").fill("Contrato aprovado");
  await page.getByLabel("Status", { exact: true }).selectOption("won");
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("won");
  await expect(
    page.getByRole("button", {
      name: "Abrir oportunidade Contrato aprovado",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page.getByLabel("Buscar clientes").fill("Carolina");
  await expect(
    page.getByRole("button", { name: "Editar cliente Carolina Teste" }),
  ).toBeVisible();
});

test("cria, edita, reordena, duplica e exclui um funil", async ({ page }) => {
  await page
    .getByRole("button", { name: "Gerenciar funis", exact: true })
    .click();
  await page.getByRole("button", { name: "Criar funil", exact: true }).click();
  await page.getByLabel("Nome do funil").fill("Pós-venda");
  await page.getByLabel("Nome da etapa 1", { exact: true }).fill("Onboarding");
  await page
    .getByRole("button", { name: "Descer etapa 1", exact: true })
    .click();
  await expect(page.getByLabel("Nome da etapa 2", { exact: true })).toHaveValue(
    "Onboarding",
  );
  await page
    .getByRole("button", { name: "Adicionar etapa", exact: true })
    .click();
  await page.getByLabel("Nome da etapa 4", { exact: true }).fill("Renovação");
  await page.getByRole("button", { name: "Criar funil", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Selecionar funil: Pós-venda",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Renovação", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ações do funil" }).click();
  await page.getByRole("menuitem", { name: "Editar funil e etapas" }).click();
  await page.getByLabel("Nome do funil").fill("Sucesso do cliente");
  await page
    .getByRole("button", { name: "Excluir etapa 4", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    page.getByRole("heading", { name: "Renovação", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Ações do funil" }).click();
  await page.getByRole("menuitem", { name: "Duplicar funil" }).click();
  await expect(
    page.getByRole("button", {
      name: "Selecionar funil: Sucesso do cliente (cópia)",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ações do funil" }).click();
  await page.getByRole("menuitem", { name: "Excluir funil" }).click();
  await page
    .getByRole("button", { name: "Excluir funil", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  const stored = (await (await page.request.get("/api/crm")).json()).data;
  expect(stored.pipelines.map((p: { name: string }) => p.name)).toContain(
    "Sucesso do cliente",
  );
  expect(stored.pipelines.map((p: { name: string }) => p.name)).not.toContain(
    "Sucesso do cliente (cópia)",
  );
});

test("excluir etapas e funis transfere oportunidades sem perda", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ações do funil" }).click();
  await page.getByRole("menuitem", { name: "Editar funil e etapas" }).click();
  await page
    .getByRole("button", { name: "Excluir etapa 1", exact: true })
    .click();
  await expect(
    page.getByText(/3 oportunidade\(s\) das etapas excluídas/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(
    page.getByTestId("stage-stage-qualified").getByTestId("deal-deal-0"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ações do funil" }).click();
  await page.getByRole("menuitem", { name: "Excluir funil" }).click();
  await expect(
    page.getByText(/11 oportunidade\(s\) serão preservadas/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir funil", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Selecionar funil: Parcerias" }),
  ).toBeVisible();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  const stored = (await (await page.request.get("/api/crm")).json()).data;
  expect(stored.deals).toHaveLength(12);
  expect(stored.pipelines).toHaveLength(1);
  await page.getByRole("button", { name: "Ações do funil" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Excluir funil" }),
  ).toBeDisabled();
});

test("pesquisa, combina filtros e alterna para lista", async ({ page }) => {
  await page.getByLabel("Buscar oportunidades").fill("orbita");
  await expect(page.locator(".deal-card")).toHaveCount(1);
  await expect(page.getByTestId("deal-deal-1")).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByLabel("Responsável", { exact: true })
    .selectOption("Paulo Kleyzer");
  await page.getByLabel("Prioridade", { exact: true }).selectOption("high");
  await expect(page.locator(".deal-card")).toHaveCount(4);
  await page.getByRole("button", { name: "Visualização em lista" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Limpar filtros", exact: true })
    .click();
  await expect(page.getByRole("row")).toHaveCount(11);
  await page
    .getByRole("button", { name: "Nova identidade e website", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Detalhes da oportunidade" }),
  ).toBeVisible();
});

test("exclui uma oportunidade somente após confirmação", async ({ page }) => {
  await page.getByTestId("deal-deal-0").click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Excluir oportunidade?" })
    .getByRole("button", { name: "Cancelar" })
    .click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await page
    .getByRole("button", { name: "Excluir oportunidade", exact: true })
    .click();
  await expect(page.getByTestId("deal-deal-0")).toHaveCount(0);
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".deal-card")).toHaveCount(9);
});

test("exporta e restaura backup validado", async ({ page }) => {
  await page
    .getByRole("button", { name: "Menu do espaço de trabalho" })
    .click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Exportar backup" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toContain("meu-crm-backup");
  const path = await download.path();
  await page
    .getByRole("button", { name: "Menu do espaço de trabalho" })
    .click();
  await page.getByRole("menuitem", { name: "Importar backup" }).click();
  await page.getByLabel("Importar backup JSON").setInputFiles(path!);
  await expect(
    page.getByRole("dialog", { name: "Restaurar este backup?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restaurar backup", exact: true })
    .click();
  await expect(page.locator(".deal-card")).toHaveCount(10);
});

test("usa PostgreSQL mesmo quando o armazenamento local contém dados antigos inválidos", async ({
  page,
}) => {
  await page.evaluate((key) => localStorage.setItem(key, "invalid-json"), KEY);
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".deal-card")).toHaveCount(10);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    "invalid-json",
  );
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
});

test("navega entre clientes e indicadores", async ({ page }) => {
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar cliente Ana Oliveira" })
    .click();
  await page.getByLabel("Nome do contato").fill("Ana Oliveira Silva");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(
    page.getByRole("button", { name: "Editar cliente Ana Oliveira Silva" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Oportunidades por funil" }),
  ).toBeVisible();
  await expect(page.getByText("Receita conquistada")).toBeVisible();
});

test("layout móvel preserva navegação e cadastro sem transbordar a página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Nova oportunidade", exact: true }),
  ).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page
    .getByRole("button", { name: "Nova oportunidade", exact: true })
    .click();
  await expect(page.getByLabel("Título da oportunidade")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Novo cliente", exact: true }),
  ).toBeVisible();
});

test("acessibilidade básica do quadro e do formulário", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const board = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    board.violations.map((v) => ({
      rule: v.id,
      elements: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Nova oportunidade", exact: true })
    .click();
  const form = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    form.violations.map((v) => ({
      rule: v.id,
      elements: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("reorganiza etapas arrastando no editor de funil", async ({ page }) => {
  await page.getByRole("button", { name: "Ações do funil" }).click();
  await page.getByRole("menuitem", { name: "Editar funil e etapas" }).click();
  await drag(
    page,
    page.getByRole("button", { name: "Arrastar etapa Novo lead", exact: true }),
    page.locator(".stage-editor-row").nth(2),
  );
  await expect(page.getByLabel("Nome da etapa 3", { exact: true })).toHaveValue(
    "Novo lead",
  );
  await page
    .getByRole("button", { name: "Salvar alterações", exact: true })
    .click();
  await expect(page.locator(".column-title h2").first()).toHaveText(
    "Qualificação",
  );
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".column-title h2").nth(2)).toHaveText("Novo lead");
});

test("arrasta uma oportunidade por toque no celular", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 1000 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Selecionar funil:" }).click();
  await page.getByRole("menuitem", { name: "Parcerias", exact: true }).click();
  const card = page.getByTestId("deal-deal-partner");
  await card.scrollIntoViewIfNeeded();
  const from = (await card.boundingBox())!;
  const to = (await page
    .getByTestId("dropzone-partner-meeting")
    .boundingBox())!;
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: Math.min(to.x + 40, 370), y: start.y };
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1 }],
  });
  await expect(page.locator(".overlay-card")).toBeVisible();
  for (let i = 1; i <= 15; i++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: start.x + ((end.x - start.x) * i) / 15,
          y: start.y + ((end.y - start.y) * i) / 15,
          id: 1,
        },
      ],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(
    page.getByTestId("stage-partner-meeting").getByTestId("deal-deal-partner"),
  ).toBeVisible();
  await expect(
    page.getByText("Salvo no PostgreSQL", { exact: true }),
  ).toBeVisible();
  const stored = (await (await page.request.get("/api/crm")).json()).data;
  expect(
    stored.deals.find((d: { id: string }) => d.id === "deal-partner").stageId,
  ).toBe("partner-meeting");
  await context.close();
});
