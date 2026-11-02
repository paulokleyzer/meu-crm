import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAccess } from "@/server/access";

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
