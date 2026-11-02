import { afterEach, describe, expect, it, vi } from "vitest";
import { assertNetlifyDeploymentEnabled } from "@/lib/deployment-policy";
import { syncInterval } from "@/lib/sync-policy";
import { HttpCrmRepository } from "@/lib/http-repository";
import { spawnSync } from "node:child_process";

afterEach(() => vi.unstubAllGlobals());
const project = {
  SITE_NAME: "lucky-donut-3d0c63",
  URL: "https://lucky-donut-3d0c63.netlify.app",
};
const runIgnore = (env: Record<string, string>) =>
  spawnSync(process.execPath, ["scripts/netlify-ignore.mjs"], {
    env: { ...env, NODE_ENV: "test" },
    encoding: "utf8",
  });
describe("habilitação explícita da publicação e consumo de sincronização", () => {
  it("permite o projeto existente, sua URL e URLs de preview quando habilitado", () => {
    for (const metadata of [
      project,
      { DEPLOY_URL: "https://123--lucky-donut-3d0c63.netlify.app" },
      { DEPLOY_PRIME_URL: "https://preview--lucky-donut-3d0c63.netlify.app" },
    ])
      expect(() =>
        assertNetlifyDeploymentEnabled({ ...metadata, CRM_DEPLOY_V2: "true" }),
      ).not.toThrow();
  });
  it("bloqueia a publicação sem a habilitação exata, mesmo no projeto existente", () => {
    for (const value of [undefined, "", "false", "TRUE", "1", "true "])
      expect(() =>
        assertNetlifyDeploymentEnabled({ ...project, CRM_DEPLOY_V2: value }),
      ).toThrow("PUBLICACAO_BLOQUEADA");
  });
  it("não restringe o nome do projeto: a exigência é a variável de habilitação", () => {
    expect(() =>
      assertNetlifyDeploymentEnabled({
        SITE_NAME: "outro-projeto",
        CRM_DEPLOY_V2: "true",
      }),
    ).not.toThrow();
    expect(() =>
      assertNetlifyDeploymentEnabled({ SITE_NAME: "outro-projeto" }),
    ).toThrow("PUBLICACAO_BLOQUEADA");
  });
  it("pula builds automáticos no projeto existente enquanto a publicação estiver desabilitada", () => {
    for (const env of [
      project,
      { ...project, CRM_DEPLOY_V2: "false" },
      { ...project, CRM_DEPLOY_V2: "TRUE" },
    ]) {
      const result = runIgnore(env);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("build ignorado");
    }
  });
  it("continua o build do projeto existente e de previews somente com true", () => {
    for (const env of [
      project,
      { ...project, DEPLOY_URL: "https://123--lucky-donut-3d0c63.netlify.app" },
    ]) {
      const result = runIgnore({ ...env, CRM_DEPLOY_V2: "true" });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("continuar o build");
    }
  });
  it("bloqueia o comando de build antes de iniciar Next.js se o descarte for pulado", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/netlify-build.ts"],
      {
        env: { ...project, CRM_DEPLOY_V2: "false", NODE_ENV: "test" },
        encoding: "utf8",
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("PUBLICACAO_BLOQUEADA");
    expect(result.stdout).not.toContain("Next.js");
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
