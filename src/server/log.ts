/**
 * Logs da aplicação (#91, ARQUITETURA.md §9.4): uma linha por evento, em JSON em produção e em
 * texto legível em desenvolvimento. Sem dependências e sem APIs exclusivas do Node.
 *
 * - `evento` é um identificador estável (ex.: `auth.login_falhou`) para filtrar nos logs.
 * - Nível mínimo por `LOG_LEVEL` (padrão: `info` em produção, `debug` em dev, `silent` em teste).
 * - `warn`/`error` vão para stderr e os demais para stdout. O MCP stdio liga a saída só em stderr,
 *   porque lá o stdout é o canal do protocolo.
 * - Defesa em profundidade: campos com nome de segredo (senha, token, cookie…) são omitidos; em
 *   qualquer texto, valores de parâmetros sensíveis de URL são removidos e e-mails mascarados; os
 *   `params` das queries do Drizzle saem das mensagens de erro. Mesmo assim, quem chama não deve
 *   passar segredos nem e-mails completos (use `mascararEmail`).
 */

export const NIVEIS_LOG = ["debug", "info", "warn", "error"] as const;
export type NivelLog = (typeof NIVEIS_LOG)[number];
type NivelMinimo = NivelLog | "silent";
type FormatoLog = "json" | "texto";

export type CamposLog = Record<string, unknown>;

interface ConfigLog {
  nivel: NivelMinimo;
  formato: FormatoLog;
  /** `stderr`: tudo em stderr (MCP stdio). */
  saida: "padrao" | "stderr";
}

const PESO: Record<NivelMinimo, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

let ajustes: Partial<ConfigLog> = {};

/** Sobrepõe a configuração vinda do ambiente (scripts e testes). `{}` volta ao padrão. */
export function configurarLog(novos: Partial<ConfigLog>): void {
  ajustes = { ...novos };
}

function ehNivel(v: string | undefined): v is NivelMinimo {
  return v !== undefined && v in PESO;
}

function configAtual(): ConfigLog {
  const ambiente = process.env.NODE_ENV;
  const nivelEnv = process.env.LOG_LEVEL?.trim().toLowerCase();
  const formatoEnv = process.env.LOG_FORMAT?.trim().toLowerCase();
  const nivelPadrao: NivelMinimo =
    ambiente === "test" ? "silent" : ambiente === "production" ? "info" : "debug";
  return {
    nivel: ajustes.nivel ?? (ehNivel(nivelEnv) ? nivelEnv : nivelPadrao),
    formato:
      ajustes.formato ??
      (formatoEnv === "json" || formatoEnv === "texto"
        ? formatoEnv
        : ambiente === "production"
          ? "json"
          : "texto"),
    saida: ajustes.saida ?? "padrao",
  };
}

// --- Privacidade --------------------------------------------------------------------------------

const CAMPO_SENSIVEL = /senha|password|passwd|token|secret|segredo|cookie|authorization/i;
/** Parâmetros de URL cujo valor nunca vai para o log (o nome fica). */
const PARAM_SENSIVEL =
  /([?&](?:[\w-]*(?:token|senha|pass|secret|segredo|key|chave|cookie|auth|sess|e-?mail)[\w-]*|code|state)=)[^&#\s"']*/gi;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const REMOVIDO = "[removido]";
const CABECALHO = new Set(["ts", "nivel", "evento"]);

/** Remove de um texto (URL, mensagem de erro) os valores de parâmetros de query sensíveis. */
export function semSegredosNaUrl(texto: string): string {
  return texto.replace(PARAM_SENSIVEL, `$1${REMOVIDO}`);
}

/** Texto com parâmetros sensíveis removidos e e-mails mascarados (`r***@dominio`). */
export function semDadosSensiveis(texto: string): string {
  return semSegredosNaUrl(texto).replace(EMAIL, "$1***@$2");
}

/**
 * Mensagem/stack de erro sem os parâmetros de query: o Drizzle anexa `\nparams: …` ao fim da
 * mensagem de "Failed query" (valores que podem ter várias linhas, e-mails e dados do usuário).
 * Remove tudo dali até o fim da mensagem ou até o início da stack. A SQL em si fica.
 */
function semParametrosDeQuery(texto: string): string {
  return texto.replace(/\nparams: [\s\S]*?(?=\n\s+at |$)/g, `\nparams: ${REMOVIDO}`);
}

/** `rodrigo@gmail.com` → `r***@gmail.com`. Prefira registrar o `usuarioId` quando houver. */
export function mascararEmail(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const arroba = email.lastIndexOf("@");
  if (arroba <= 0) return "***";
  return `${email[0]}***${email.slice(arroba)}`;
}

const PROFUNDIDADE_MAX = 4;

function serializarErro(erro: Error, profundidade: number): CamposLog {
  const r: CamposLog = {
    nome: erro.name,
    mensagem: semDadosSensiveis(semParametrosDeQuery(erro.message)),
  };
  if (erro.stack) r.stack = semDadosSensiveis(semParametrosDeQuery(erro.stack));
  const digest = (erro as { digest?: unknown }).digest;
  if (typeof digest === "string") r.digest = digest;
  if (erro.cause !== undefined) r.causa = limpar(erro.cause, profundidade + 1);
  return r;
}

/** Cópia segura dos campos: erros serializados, segredos omitidos, profundidade limitada. */
function limpar(valor: unknown, profundidade = 0): unknown {
  if (typeof valor === "string") return semDadosSensiveis(valor);
  if (typeof valor === "bigint") return valor.toString();
  if (valor === null || typeof valor !== "object") {
    return typeof valor === "function" || typeof valor === "symbol" ? String(valor) : valor;
  }
  if (profundidade >= PROFUNDIDADE_MAX) return "[…]";
  if (valor instanceof Error) return serializarErro(valor, profundidade);
  if (valor instanceof Date) return valor.toISOString();
  if (Array.isArray(valor)) return valor.map((v) => limpar(v, profundidade + 1));
  const r: CamposLog = {};
  for (const [chave, v] of Object.entries(valor)) {
    if (v === undefined) continue;
    r[chave] = CAMPO_SENSIVEL.test(chave) ? REMOVIDO : limpar(v, profundidade + 1);
  }
  return r;
}

// --- Formatação ---------------------------------------------------------------------------------

function linhaJson(registro: CamposLog): string {
  try {
    return JSON.stringify(registro);
  } catch {
    // Referência circular ou similar: registra ao menos o evento.
    return JSON.stringify({ ts: registro.ts, nivel: registro.nivel, evento: registro.evento });
  }
}

function linhaTexto(ts: string, nivel: NivelLog, evento: string, campos: CamposLog): string {
  const partes: string[] = [];
  const pilhas: string[] = [];
  for (const [chave, v] of Object.entries(campos)) {
    if (v && typeof v === "object" && "stack" in v && typeof v.stack === "string") {
      const { stack, ...resto } = v as CamposLog & { stack: string };
      pilhas.push(stack);
      partes.push(`${chave}=${JSON.stringify(resto)}`);
    } else {
      partes.push(`${chave}=${JSON.stringify(v)}`);
    }
  }
  const cabecalho = `${ts} ${nivel.toUpperCase().padEnd(5)} ${evento}`;
  const linha = partes.length > 0 ? `${cabecalho} ${partes.join(" ")}` : cabecalho;
  return pilhas.length > 0 ? `${linha}\n${pilhas.join("\n")}` : linha;
}

function registrar(
  nivel: NivelLog,
  evento: string,
  campos: CamposLog = {},
  ignorarNivel = false,
): void {
  const config = configAtual();
  if (!ignorarNivel && PESO[nivel] < PESO[config.nivel]) return;
  const ts = new Date().toISOString();
  const limpos = limpar(campos) as CamposLog;
  // Campos não sobrescrevem o cabeçalho da linha.
  for (const chave of CABECALHO) delete limpos[chave];
  const linha =
    config.formato === "json"
      ? linhaJson({ ts, nivel, evento, ...limpos })
      : linhaTexto(ts, nivel, evento, limpos);
  const stderr = config.saida === "stderr" || PESO[nivel] >= PESO.warn;
  if (stderr) console.error(linha);
  else console.log(linha);
}

export const log = {
  debug: (evento: string, campos?: CamposLog) => registrar("debug", evento, campos),
  info: (evento: string, campos?: CamposLog) => registrar("info", evento, campos),
  warn: (evento: string, campos?: CamposLog) => registrar("warn", evento, campos),
  error: (evento: string, campos?: CamposLog) => registrar("error", evento, campos),
  /** Erro que encerra o processo: sai mesmo com `LOG_LEVEL=silent`. */
  fatal: (evento: string, campos?: CamposLog) => registrar("error", evento, campos, true),
};
