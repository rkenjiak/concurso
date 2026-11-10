/**
 * Versão do app (#118): ponto único de leitura no código, no servidor e no cliente.
 *
 * - `versao`: a do `package.json`, atualizada a cada `release/X.Y.Z`;
 * - `commit`: SHA curto da build, que distingue builds com a mesma versão (ex.: previews);
 * - `ambiente`: `production`, `preview` ou `development`;
 * - `dataBuild`: instante do build (ISO 8601), ou `null` se não informado.
 *
 * Os valores chegam por `process.env.APP_*`, calculados em `versao-build.ts` e fixados no build
 * pelo `env` do `next.config.ts`: o bundle do cliente recebe só esses quatro textos. Este módulo
 * não importa o `package.json`, que iria inteiro para o bundle. Fora do Next, quem inicia o
 * processo preenche os `APP_*` antes (MCP por stdio: `definirVersaoNoAmbiente`; Vitest: config).
 */

export const AMBIENTES = ["production", "preview", "development"] as const;
export type Ambiente = (typeof AMBIENTES)[number];

export interface VersaoApp {
  versao: string;
  commit: string;
  ambiente: Ambiente;
  dataBuild: string | null;
}

/** Versão quando nada a informa (processo iniciado fora do Next sem os `APP_*`). */
export const VERSAO_DESCONHECIDA = "0.0.0";
/** Commit quando nenhuma fonte informa o SHA (imagem sem build arg, pasta sem git). */
export const COMMIT_DESCONHECIDO = "dev";

// Acesso direto (`process.env.APP_X`), sem desestruturar: é o que o Next substitui no build.
export const versao: string = process.env.APP_VERSAO || VERSAO_DESCONHECIDA;
export const commit: string = process.env.APP_COMMIT || COMMIT_DESCONHECIDO;
export const ambiente: Ambiente = AMBIENTES.includes(process.env.APP_AMBIENTE as Ambiente)
  ? (process.env.APP_AMBIENTE as Ambiente)
  : process.env.NODE_ENV === "production"
    ? "production"
    : "development";
export const dataBuild: string | null = process.env.APP_DATA_BUILD || null;

/** Tudo junto (admin, feedback). */
export const VERSAO_APP: VersaoApp = { versao, commit, ambiente, dataBuild };

/**
 * Rótulo curto: `v2.7.0` em produção; em preview e dev, também o commit e o ambiente
 * (`v2.7.0 · a1b2c3d · preview`), porque várias builds compartilham a mesma versão.
 */
export function rotuloVersao(info: Pick<VersaoApp, "versao" | "commit" | "ambiente">): string {
  const v = `v${info.versao}`;
  return info.ambiente === "production" ? v : `${v} · ${info.commit} · ${info.ambiente}`;
}

const REPOSITORIO = "https://github.com/rkenjiak/concurso";

/** GitHub Release da versão ("O que há de novo"), criada pelo `release.yml` com a tag `vX.Y.Z`. */
export function urlRelease(v: string = versao): string {
  return `${REPOSITORIO}/releases/tag/v${v}`;
}

/** Commit no GitHub; `null` quando a build não informou o SHA (`dev`). */
export function urlCommit(c: string = commit): string | null {
  return c === COMMIT_DESCONHECIDO ? null : `${REPOSITORIO}/commit/${c}`;
}

/** CHANGELOG na branch de produção. */
export const URL_CHANGELOG = `${REPOSITORIO}/blob/master/CHANGELOG.md`;
