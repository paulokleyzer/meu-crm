// Netlify CLI 27.16.2 tries to provision Database even with --offline. Validate
// the adapter/migrations in a disposable fixture, never altering production
// dependencies. This is packaging validation, NOT a hosted deploy validation.
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  stat,
} from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const fixture = await mkdtemp(join(tmpdir(), "crm-netlify-runtime-"));
const excluded = new Set([
  "node_modules",
  ".git",
  ".next",
  ".netlify",
  "out",
  "test-results",
  "playwright-report",
  "coverage",
  "deploy",
]);
for (const entry of await readdir(root)) {
  if (excluded.has(entry) || entry.startsWith(".env")) continue;
  await cp(join(root, entry), join(fixture, entry), { recursive: true });
}
await cp(join(root, "node_modules"), join(fixture, "node_modules"), {
  recursive: true,
  mode: constants.COPYFILE_FICLONE,
});
const packageFile = join(fixture, "package.json");
const manifest = JSON.parse(await readFile(packageFile, "utf8"));
delete manifest.dependencies["@netlify/database"];
await writeFile(packageFile, JSON.stringify(manifest, null, 2));
console.log(
  "Validação local do adaptador oficial: aprovisionamento remoto excluído somente da fixture temporária. Nenhum projeto será criado ou publicado.",
);
const result = spawnSync(
  process.execPath,
  [join(fixture, "node_modules/netlify-cli/bin/run.js"), "build", "--offline"],
  {
    cwd: fixture,
    stdio: "inherit",
    env: {
      ...process.env,
      // Only this unlinked, offline fixture enables the guarded build.
      CRM_DEPLOY_V2: "true",
      NETLIFY_TELEMETRY_DISABLED: "1",
      XDG_CONFIG_HOME: join(fixture, ".cli-config"),
    },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const migrations = (await readdir(join(root, "netlify/database/migrations")))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort()
  .map((name) => name.slice(0, -4));
for (const name of migrations) {
  const source = await readFile(
    join(root, "netlify/database/migrations", name + ".sql"),
  );
  const artifact = await readFile(
    join(fixture, ".netlify/internal/db/migrations", name, "migration.sql"),
  );
  if (!source.equals(artifact)) throw new Error("MIGRATION_ARTIFACT_MISMATCH");
}
const secrets = [
  "CRM_BASIC_PASSWORD",
  "DATABASE_URL",
  "NETLIFY_DB_URL",
  "NETLIFY_AUTH_TOKEN",
]
  .map((n) => process.env[n])
  .filter((v) => v && v.length >= 16);
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(?:js|json|html|map|css|svg|txt)$/.test(entry.name)) {
      const data = await readFile(file, "utf8");
      if (secrets.some((secret) => data.includes(secret)))
        throw new Error("SENSITIVE_VALUE_IN_BROWSER_ARTIFACT");
    }
  }
}
await scan(join(fixture, ".next/static"));
await scan(join(fixture, ".netlify/static"));
await stat(
  join(fixture, ".netlify/functions-internal/___netlify-server-handler"),
);
const edgeDirectory = join(fixture, ".netlify/edge-functions-dist");
const edgeManifest = JSON.parse(
  await readFile(join(edgeDirectory, "manifest.json"), "utf8"),
);
if (
  !edgeManifest.routes.some(
    (route) => route.function === "___netlify-edge-handler-node-middleware",
  ) ||
  !edgeManifest.bundles.length
)
  throw new Error("PROTECTION_PROXY_NOT_PACKAGED");
for (const bundle of edgeManifest.bundles) {
  if (!(await stat(join(edgeDirectory, bundle.asset))).size)
    throw new Error("EMPTY_EDGE_BUNDLE");
}
const runtime = spawnSync(
  process.execPath,
  [join(root, "scripts/validate-netlify-function.mjs"), fixture],
  { cwd: root, stdio: "inherit", env: process.env },
);
if (runtime.error) throw runtime.error;
if (runtime.status !== 0) process.exit(runtime.status ?? 1);
await mkdir(join(root, ".netlify"), { recursive: true });
await writeFile(
  join(root, ".netlify/runtime-validation.json"),
  JSON.stringify(
    {
      fixture,
      adapter: "5.16.5",
      migrations: migrations.length,
      browserSecretsFound: false,
      protectionProxyPackaged: true,
      packagedFunctionPersistenceValidated: true,
      hostedDeploymentValidated: false,
    },
    null,
    2,
  ),
);
console.log(
  "Função Next.js, migrações e ausência de credenciais nos arquivos do navegador verificadas. Fixture:",
  fixture,
);
