import { afterEach, describe, expect, it, vi } from "vitest";
import { version } from "../../package.json";
import { rotuloVersao, URL_CHANGELOG, urlCommit, urlRelease, VERSAO_APP } from "./versao";
import {
  definirVersaoNoAmbiente,
  resolverAmbiente,
  resolverCommit,
  valoresBuild,
} from "./versao-build";

const SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const VARIAVEIS = [
  "APP_VERSAO",
  "APP_COMMIT",
  "APP_AMBIENTE",
  "APP_DATA_BUILD",
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_SHA",
  "GIT_COMMIT_SHA",
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("resolverCommit", () => {
  it("prioriza a Vercel, depois o build arg e por fim o git, em SHA curto", () => {
    expect(resolverCommit({ vercel: SHA, buildArg: "ffffffff", git: "eeeeeeee" })).toBe("a1b2c3d");
    expect(resolverCommit({ vercel: "", buildArg: "ffffffffff", git: "eeeeeeee" })).toBe("fffffff");
    expect(resolverCommit({ vercel: undefined, buildArg: "  ", git: SHA })).toBe("a1b2c3d");
  });

  it("sem nenhuma fonte, cai em `dev`", () => {
    expect(resolverCommit({})).toBe("dev");
    expect(resolverCommit({ vercel: null, buildArg: "", git: null })).toBe("dev");
  });
});

describe("resolverAmbiente", () => {
  it("usa VERCEL_ENV quando válido", () => {
    expect(resolverAmbiente("production", "production")).toBe("production");
    expect(resolverAmbiente("preview", "production")).toBe("preview");
    expect(resolverAmbiente("development", "production")).toBe("development");
  });

  it("sem VERCEL_ENV (Docker, local), cai em NODE_ENV", () => {
    expect(resolverAmbiente(undefined, "production")).toBe("production");
    expect(resolverAmbiente("", "development")).toBe("development");
    expect(resolverAmbiente("outro", "test")).toBe("development");
    expect(resolverAmbiente(undefined, undefined)).toBe("development");
  });
});

describe("valoresBuild", () => {
  const agora = new Date("2026-11-09T12:00:00Z");
  const semGit = () => null;

  it("Vercel: commit e ambiente da plataforma, sem consultar o git", () => {
    const git = vi.fn(() => "0000000");
    expect(
      valoresBuild(
        { VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: "preview", NODE_ENV: "production" },
        git,
        agora,
      ),
    ).toEqual({
      APP_VERSAO: version,
      APP_COMMIT: "a1b2c3d",
      APP_AMBIENTE: "preview",
      APP_DATA_BUILD: "2026-11-09T12:00:00.000Z",
    });
    expect(git).not.toHaveBeenCalled();
  });

  it("Docker: build arg GIT_COMMIT_SHA; sem ele nem git, `dev`", () => {
    expect(valoresBuild({ GIT_COMMIT_SHA: SHA, NODE_ENV: "production" }, semGit, agora)).toEqual(
      expect.objectContaining({ APP_COMMIT: "a1b2c3d", APP_AMBIENTE: "production" }),
    );
    expect(valoresBuild({ NODE_ENV: "production" }, semGit, agora).APP_COMMIT).toBe("dev");
  });

  it("local: SHA do git", () => {
    expect(valoresBuild({ NODE_ENV: "development" }, () => SHA, agora)).toEqual(
      expect.objectContaining({ APP_COMMIT: "a1b2c3d", APP_AMBIENTE: "development" }),
    );
  });
});

describe("valores lidos por versao.ts", () => {
  async function carregar(env: Record<string, string>) {
    for (const nome of VARIAVEIS) vi.stubEnv(nome, env[nome] ?? "");
    vi.resetModules();
    return import("./versao");
  }

  it("no Vitest, como o build fixaria: versão do package.json, commit `dev`", () => {
    expect(VERSAO_APP).toEqual({
      versao: version,
      commit: "dev",
      ambiente: "development",
      dataBuild: expect.any(String),
    });
  });

  it("os valores fixados no build têm prioridade sobre os da plataforma", async () => {
    const v = await carregar({
      APP_VERSAO: "9.9.9",
      APP_COMMIT: "1234567",
      APP_AMBIENTE: "production",
      APP_DATA_BUILD: "2026-11-09T12:00:00.000Z",
      VERCEL_GIT_COMMIT_SHA: SHA,
      VERCEL_ENV: "preview",
    });
    expect(v.VERSAO_APP).toEqual({
      versao: "9.9.9",
      commit: "1234567",
      ambiente: "production",
      dataBuild: "2026-11-09T12:00:00.000Z",
    });
  });

  it("sem os valores do build, versão 0.0.0, commit `dev` e ambiente pelo NODE_ENV", async () => {
    // Variáveis da plataforma não contam em tempo de execução: só o que o build fixou.
    const v = await carregar({ VERCEL_GIT_COMMIT_SHA: SHA, VERCEL_ENV: "preview" });
    expect(v.VERSAO_APP).toEqual({
      versao: "0.0.0",
      commit: "dev",
      ambiente: "development",
      dataBuild: null,
    });
  });

  it("definirVersaoNoAmbiente preenche só o que falta (MCP por stdio)", () => {
    const env: Record<string, string | undefined> = { APP_COMMIT: "1234567", GIT_COMMIT_SHA: SHA };
    definirVersaoNoAmbiente(env);
    expect(env).toMatchObject({
      APP_VERSAO: version,
      APP_COMMIT: "1234567",
      APP_AMBIENTE: "development",
      APP_DATA_BUILD: expect.any(String),
    });
  });
});

describe("rotuloVersao", () => {
  it("em produção, só a versão", () => {
    expect(rotuloVersao({ versao: "2.7.0", commit: "a1b2c3d", ambiente: "production" })).toBe(
      "v2.7.0",
    );
  });

  it("em preview e dev, também o commit e o ambiente", () => {
    expect(rotuloVersao({ versao: "2.7.0", commit: "a1b2c3d", ambiente: "preview" })).toBe(
      "v2.7.0 · a1b2c3d · preview",
    );
    expect(rotuloVersao({ versao: "2.7.0", commit: "dev", ambiente: "development" })).toBe(
      "v2.7.0 · dev · development",
    );
  });
});

describe("links", () => {
  it("GitHub Release da versão, commit e CHANGELOG", () => {
    expect(urlRelease("2.7.0")).toBe("https://github.com/rkenjiak/concurso/releases/tag/v2.7.0");
    expect(urlRelease()).toBe(`https://github.com/rkenjiak/concurso/releases/tag/v${version}`);
    expect(urlCommit("a1b2c3d")).toBe("https://github.com/rkenjiak/concurso/commit/a1b2c3d");
    expect(urlCommit("dev")).toBeNull();
    expect(URL_CHANGELOG).toBe("https://github.com/rkenjiak/concurso/blob/master/CHANGELOG.md");
  });
});
