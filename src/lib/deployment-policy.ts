const protectedSite = "lucky-donut-3d0c63";
export function assertSeparateNetlifyProject(
  environment: Record<string, string | undefined>,
) {
  if (environment.SITE_NAME === protectedSite)
    throw new Error(
      "PUBLICACAO_BLOQUEADA: o projeto Netlify antigo deve permanecer intacto.",
    );
  for (const key of ["URL", "DEPLOY_URL", "DEPLOY_PRIME_URL"]) {
    const value = environment[key];
    if (!value) continue;
    let hostname: string;
    try {
      hostname = new URL(value).hostname;
    } catch {
      throw new Error("METADADOS_NETLIFY_INVALIDOS");
    }
    if (
      hostname === `${protectedSite}.netlify.app` ||
      hostname.endsWith(`--${protectedSite}.netlify.app`)
    )
      throw new Error("PUBLICACAO_BLOQUEADA: use um segundo projeto Netlify.");
  }
}
