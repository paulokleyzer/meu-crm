import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSeparateNetlifyProject } from "@/lib/deployment-policy";
import { syncInterval } from "@/lib/sync-policy";
import { HttpCrmRepository } from "@/lib/http-repository";
import { spawnSync } from "node:child_process";

afterEach(() => vi.unstubAllGlobals());
describe("publicação isolada e consumo de sincronização", () => {
  it("bloqueia o projeto antigo pelo nome e por URLs permanentes ou de preview", () => {
    for (const env of [
      { SITE_NAME: "lucky-donut-3d0c63" },
      { URL: "https://lucky-donut-3d0c63.netlify.app" },
      { DEPLOY_URL: "https://123--lucky-donut-3d0c63.netlify.app" },
    ])
      expect(() => assertSeparateNetlifyProject(env)).toThrow(
        "PUBLICACAO_BLOQUEADA",
      );
  });
  it("permite empacotamento offline e um segundo projeto", () => {
    expect(() => assertSeparateNetlifyProject({})).not.toThrow();
    expect(() =>
      assertSeparateNetlifyProject({
        SITE_NAME: "crm-postgres-teste",
        URL: "https://crm-postgres-teste.netlify.app",
      }),
    ).not.toThrow();
  });
  it("ignora builds automáticos do projeto antigo antes de instalar dependências", () => {
    const run = (env: Record<string, string>) =>
      spawnSync(process.execPath, ["scripts/netlify-ignore.mjs"], {
        env: { ...env, NODE_ENV: "test" },
        encoding: "utf8",
      });
    expect(run({ SITE_NAME: "lucky-donut-3d0c63" }).status).toBe(0);
    expect(
      run({
        DEPLOY_PRIME_URL: "https://preview--lucky-donut-3d0c63.netlify.app",
      }).status,
    ).toBe(0);
    expect(
      run({
        SITE_NAME: "crm-novo",
        URL: "https://crm-novo.netlify.app",
        CRM_DEPLOY_V2: "true",
      }).status,
    ).toBe(1);
    expect(
      run({ SITE_NAME: "crm-novo", URL: "https://crm-novo.netlify.app" })
        .status,
    ).toBe(0);
  });
  it("reduz a frequência durante uso e suspende consultas em abas ocultas ou inativas", () => {
    expect(syncInterval(true, 0)).toBe(30000);
    expect(syncInterval(true, 90000)).toBe(120000);
    expect(syncInterval(false, 0)).toBeNull();
    expect(syncInterval(true, 300001)).toBeNull();
  });
  it("envia a revisão conhecida e aceita 304 sem tentar ler JSON", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal("fetch", fetch);
    expect(await new HttpCrmRepository().load(42)).toBeNull();
    expect(fetch.mock.calls[0][1].headers).toEqual({
      "If-None-Match": '"revision-42"',
    });
  });
});
