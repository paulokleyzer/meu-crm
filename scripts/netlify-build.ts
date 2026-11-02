import { spawnSync } from "node:child_process";
import { assertNetlifyDeploymentEnabled } from "../src/lib/deployment-policy";
// Enforce the same switch even when a forced build bypasses build.ignore.
assertNetlifyDeploymentEnabled(process.env);
const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
