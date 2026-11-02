import { createHash, timingSafeEqual } from "node:crypto";

export function checkAccess(request: Request): Response | null {
  const user = process.env.CRM_BASIC_USER;
  const password = process.env.CRM_BASIC_PASSWORD;
  const origins = new Set(
    [
      process.env.CRM_ALLOWED_ORIGIN,
      ...(process.env.NETLIFY === "true"
        ? [
            process.env.URL,
            process.env.DEPLOY_PRIME_URL,
            process.env.DEPLOY_URL,
          ]
        : []),
    ].filter((value): value is string => Boolean(value)),
  );
  const headers = { "Cache-Control": "no-store", Vary: "Authorization" };
  if (!user || !password || password.length < 16 || origins.size === 0)
    return Response.json(
      {
        error:
          "Configure a proteção de acesso do servidor antes de usar o CRM.",
      },
      { status: 503, headers },
    );
  try {
    for (const origin of origins) {
      const url = new URL(origin);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (url.origin !== origin || (!local && url.protocol !== "https:"))
        throw new Error();
    }
  } catch {
    return Response.json(
      { error: "Origem do CRM inválida; use HTTPS para acesso externo." },
      { status: 503, headers },
    );
  }
  const auth = request.headers.get("authorization") || "";
  let candidate = "";
  if (auth.startsWith("Basic ") && auth.length < 4096)
    candidate = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const digest = (text: string) => createHash("sha256").update(text).digest();
  if (!timingSafeEqual(digest(candidate), digest(`${user}:${password}`)))
    return Response.json(
      { error: "Acesso protegido." },
      {
        status: 401,
        headers: {
          ...headers,
          "WWW-Authenticate": 'Basic realm="Meu CRM", charset="UTF-8"',
        },
      },
    );
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    if (
      !origins.has(request.headers.get("origin") || "") ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return Response.json(
        { error: "Origem da gravação não autorizada." },
        { status: 403, headers },
      );
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return Response.json({ error: "Envie JSON." }, { status: 415, headers });
  }
  return null;
}
