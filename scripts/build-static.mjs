import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const result = spawnSync(process.execPath, [cli, "build"], {
  cwd: root,
  env: { ...process.env, CRM_STATIC_EXPORT: "true" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
