import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
await writeFile(
  new URL("../.env.local", import.meta.url),
  [
    "CRM_BASIC_USER=crm",
    `CRM_BASIC_PASSWORD=${randomBytes(24).toString("hex")}`,
    "CRM_ALLOWED_ORIGIN=http://localhost:8888",
    "",
  ].join("\n"),
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Credenciais locais criadas em .env.local, sem sobrescrever arquivos existentes. O Netlify Dev fornece o banco local, sem Docker.",
);
