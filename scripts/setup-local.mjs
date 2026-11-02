import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const dbPassword = randomBytes(24).toString("hex");
const accessPassword = randomBytes(24).toString("hex");
await writeFile(
  new URL("../.env.local", import.meta.url),
  [
    `POSTGRES_PASSWORD=${dbPassword}`,
    `DATABASE_URL=postgresql://meu_crm:${dbPassword}@127.0.0.1:55432/meu_crm`,
    `TEST_DATABASE_URL=postgresql://meu_crm:${dbPassword}@127.0.0.1:55432/meu_crm`,
    "CRM_ACCESS_MODE=demo",
    "CRM_BASIC_USER=crm",
    `CRM_BASIC_PASSWORD=${accessPassword}`,
    "CRM_ALLOWED_ORIGIN=http://127.0.0.1:3000",
    "CRM_E2E_ALLOW_RESET=true",
    "",
  ].join("\n"),
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Configuração local criada em .env.local. Credenciais geradas estão nesse arquivo; nenhum arquivo existente foi sobrescrito.",
);
