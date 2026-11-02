// Netlify runs build.ignore before dependency installation. Node 24 can strip
// this small TypeScript module natively, so tsx/npm install are not required.
import { assertNetlifyDeploymentEnabled } from "../src/lib/deployment-policy.ts";

try {
  assertNetlifyDeploymentEnabled(process.env);
} catch {
  console.log(
    "CRM v2: build ignorado. Mantenha CRM_DEPLOY_V2=false até autorizar a publicação.",
  );
  // Netlify's ignore convention: zero skips the build; one continues.
  process.exit(0);
}
console.log("CRM_DEPLOY_V2=true: continuar o build do projeto configurado.");
process.exit(1);
