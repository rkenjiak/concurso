/**
 * Valores da versão fixados no build (#118). Só Node: usado pelo `next.config.ts` (`env`), pelo
 * MCP por stdio e pelo Vitest. O código do app lê o resultado por `src/lib/versao.ts`.
 *
 * Fontes: versão do `package.json`; commit de `VERCEL_GIT_COMMIT_SHA` (Vercel), do build arg
 * `GIT_COMMIT_SHA` (Docker) ou do git, senão `dev`; ambiente de `VERCEL_ENV`, senão `NODE_ENV`.
 *
 * Não importa valores de `versao.ts` (só tipos): ele lê o ambiente ao carregar, e o MCP por stdio
 * precisa preencher o ambiente antes disso.
 */
import { execFileSync } from "node:child_process";
import { version } from "../../package.json";
import type { Ambiente } from "./versao";

export type ValoresBuild = Record<
  "APP_VERSAO" | "APP_COMMIT" | "APP_AMBIENTE" | "APP_DATA_BUILD",
  string
>;

const AMBIENTES: readonly string[] = ["production", "preview", "development"] satisfies Ambiente[];
const TAMANHO_SHA_CURTO = 7;

/** Fontes do commit, em ordem de prioridade. */
export interface FontesCommit {
  /** `VERCEL_GIT_COMMIT_SHA` (Vercel). */
  vercel?: string | null;
  /** `GIT_COMMIT_SHA`: build arg do Dockerfile ou variável no ambiente do build. */
  buildArg?: string | null;
  /** `git rev-parse HEAD`. */
  git?: string | null;
}

/** SHA curto (7 caracteres) da primeira fonte preenchida; sem nenhuma, `dev`. */
export function resolverCommit(fontes: FontesCommit): string {
  for (const valor of [fontes.vercel, fontes.buildArg, fontes.git]) {
    const sha = valor?.trim();
    if (sha) return sha.slice(0, TAMANHO_SHA_CURTO);
  }
  return "dev";
}

/** `VERCEL_ENV` quando válido; senão `NODE_ENV=production` → `production`, e o resto `development`. */
export function resolverAmbiente(vercelEnv?: string | null, nodeEnv?: string | null): Ambiente {
  const vercel = vercelEnv?.trim().toLowerCase();
  if (vercel && AMBIENTES.includes(vercel)) return vercel as Ambiente;
  return nodeEnv === "production" ? "production" : "development";
}

/** SHA do commit atual pelo git, quando há repositório e git instalado; senão `null`. */
export function commitGit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

/** Os quatro `APP_*`. O git só é consultado sem SHA da plataforma nem build arg. */
export function valoresBuild(
  env: Record<string, string | undefined>,
  git: () => string | null,
  agora: Date,
): ValoresBuild {
  const vercel = env.VERCEL_GIT_COMMIT_SHA;
  const buildArg = env.GIT_COMMIT_SHA;
  return {
    APP_VERSAO: version,
    APP_COMMIT: resolverCommit({
      vercel,
      buildArg,
      git: vercel?.trim() || buildArg?.trim() ? null : git(),
    }),
    APP_AMBIENTE: resolverAmbiente(env.VERCEL_ENV, env.NODE_ENV),
    APP_DATA_BUILD: agora.toISOString(),
  };
}

/**
 * Fora do Next (MCP por stdio): preenche os `APP_*` ausentes no ambiente, como o `next build`
 * faria. Chame antes de importar `src/lib/versao.ts`, que lê os valores ao carregar.
 */
export function definirVersaoNoAmbiente(
  env: Record<string, string | undefined> = process.env,
): void {
  const valores = valoresBuild(env, commitGit, new Date());
  for (const [chave, valor] of Object.entries(valores)) env[chave] ||= valor;
}
