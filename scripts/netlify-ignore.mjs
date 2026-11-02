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
if (process.env.CRM_DEPLOY_V2 !== "true") {
  console.log(
    "CRM v2: build ignorado até configurar CRM_DEPLOY_V2=true no segundo projeto de testes.",
  );
  process.exit(0);
}
console.log("Segundo projeto com publicação v2 habilitada: continuar o build.");
process.exit(1);
