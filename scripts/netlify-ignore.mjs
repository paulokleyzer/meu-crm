// Netlify runs build.ignore before dependency installation. Node 24 can strip
// this small TypeScript module natively, so tsx/npm install are not required.
import { assertSeparateNetlifyProject } from "../src/lib/deployment-policy.ts";

try {
  assertSeparateNetlifyProject(process.env);
} catch {
  console.log("Build ignorado para preservar o projeto Netlify anterior.");
  // Netlify's ignore convention: zero skips the build; one continues.
  process.exit(0);
}
console.log("Segundo projeto: continuar o build.");
process.exit(1);
