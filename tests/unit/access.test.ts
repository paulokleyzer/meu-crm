import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAccess } from "@/server/access";

beforeEach(() => vi.stubEnv("CRM_ACCESS_MODE", "basic"));
afterEach(() => vi.unstubAllEnvs());
const user = "test-crm",
  password = "fictional-test-password-only";
const origin = "http://127.0.0.1:3000";
function configure() {
  vi.stubEnv("CRM_BASIC_USER", user);
  vi.stubEnv("CRM_BASIC_PASSWORD", password);
  vi.stubEnv("CRM_ALLOWED_ORIGIN", origin);
}
function request(method = "GET", extra: Record<string, string> = {}) {
  return new Request(origin + "/api/crm", {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
      ...extra,
    },
  });
}
describe("proteção do servidor sem tela de login", () => {
  it("aceita somente origens de previews informadas pelo Netlify, não qualquer netlify.app", () => {
    configure();
    vi.stubEnv("NETLIFY", "true");
    vi.stubEnv("DEPLOY_PRIME_URL", "https://preview--new-crm.netlify.app");
    expect(
      checkAccess(
        request("PUT", {
          origin: "https://preview--new-crm.netlify.app",
          "content-type": "application/json",
        }),
      ),
    ).toBeNull();
    expect(
      checkAccess(
        request("PUT", {
          origin: "https://attacker.netlify.app",
          "content-type": "application/json",
        }),
      )!.status,
    ).toBe(403);
  });
  it("falha fechado sem credenciais configuradas", () => {
    vi.stubEnv("CRM_BASIC_PASSWORD", "");
    expect(checkAccess(request())!.status).toBe(503);
  });
  it("protege leitura e gravação sem autenticação", () => {
    configure();
    for (const method of ["GET", "PUT"])
      expect(checkAccess(new Request(origin, { method }))!.status).toBe(401);
  });
  it("aceita leitura autenticada", () => {
    configure();
    expect(checkAccess(request())).toBeNull();
  });
  it("rejeita senha incorreta", () => {
    configure();
    expect(
      checkAccess(request("GET", { authorization: "Basic invalid" }))!.status,
    ).toBe(401);
  });
  it("exige a origem exata para gravações, inclusive clientes não browser", () => {
    configure();
    expect(
      checkAccess(request("PUT", { "content-type": "application/json" }))!
        .status,
    ).toBe(403);
    expect(
      checkAccess(
        request("PUT", {
          origin: "https://evil.example",
          "content-type": "application/json",
        }),
      )!.status,
    ).toBe(403);
  });
  it("rejeita formulários e chamadas cross-site", () => {
    configure();
    expect(
      checkAccess(request("PUT", { origin, "content-type": "text/plain" }))!
        .status,
    ).toBe(415);
    expect(
      checkAccess(
        request("PUT", {
          origin,
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        }),
      )!.status,
    ).toBe(403);
  });
  it("aceita JSON autenticado da origem permitida", () => {
    configure();
    expect(
      checkAccess(
        request("PUT", { origin, "content-type": "application/json" }),
      ),
    ).toBeNull();
  });
  it("exige HTTPS para origens externas", () => {
    configure();
    vi.stubEnv("CRM_ALLOWED_ORIGIN", "http://crm.example.com");
    expect(checkAccess(request())!.status).toBe(503);
  });
});

describe("demonstração sem solicitação de senha", () => {
  it("permite leitura sem credenciais ou cabeçalho de autenticação", () => {
    configure();
    vi.stubEnv("CRM_ACCESS_MODE", "demo");
    vi.stubEnv("CRM_BASIC_USER", "");
    vi.stubEnv("CRM_BASIC_PASSWORD", "");
    expect(checkAccess(new Request(origin + "/api/crm"))).toBeNull();
  });
  it("mantém origem e formato exigidos mesmo sem senha", () => {
    configure();
    vi.stubEnv("CRM_ACCESS_MODE", "demo");
    expect(checkAccess(new Request(origin, { method: "PUT" }))?.status).toBe(
      403,
    );
    expect(
      checkAccess(
        new Request(origin, {
          method: "PUT",
          headers: { origin, "content-type": "application/json" },
        }),
      ),
    ).toBeNull();
  });
  it("um modo desconhecido falha fechado", () => {
    configure();
    vi.stubEnv("CRM_ACCESS_MODE", "typo");
    expect(checkAccess(new Request(origin))?.status).toBe(503);
  });
});
