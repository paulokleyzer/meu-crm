import { test, expect } from "@playwright/test";

test("prévia de conversas não importa dados pessoais no modo demonstração", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Recuperação", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recuperação de leads" })).toBeVisible();
  await expect(page.getByText("Modo demonstração público", { exact: false })).toBeVisible();
  await page.getByLabel("Selecionar conversas do WhatsApp").setInputFiles({
    name: "Conversa do WhatsApp com Cliente Teste.txt",
    mimeType: "text/plain",
    buffer: Buffer.from([
      "[09/11/2026, 14:01:00] Cliente Teste: Gostaria de orçamento para energia solar.",
      "[09/11/2026, 14:02:00] Vendedor: Vamos preparar.",
    ].join("\n")),
  });
  await expect(page.getByText("Cliente Teste", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Importar oportunidades aprovadas" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Analisar com IA" })).toBeDisabled();
});
