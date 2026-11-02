export function assertNetlifyDeploymentEnabled(
  environment: Record<string, string | undefined>,
) {
  if (environment.CRM_DEPLOY_V2 !== "true")
    throw new Error(
      "PUBLICACAO_BLOQUEADA: defina CRM_DEPLOY_V2=true somente quando autorizar a publicação.",
    );
}
