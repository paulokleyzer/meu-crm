import { writeFile } from "node:fs/promises";
await writeFile(
  new URL("../.env.local", import.meta.url),
  ["CRM_ACCESS_MODE=demo", "CRM_ALLOWED_ORIGIN=http://localhost:8888", ""].join(
    "\n",
  ),
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Demonstração sem senha configurada em .env.local. O Netlify Dev fornece o banco local, sem Docker. Arquivos existentes não são sobrescritos.",
);
