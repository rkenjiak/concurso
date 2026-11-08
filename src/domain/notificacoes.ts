/**
 * Notificações no app (RF08, #65). Funções puras: sem Next, sem banco e sem relógio — `hoje` (data
 * de calendário em America/Sao_Paulo, `YYYY-MM-DD`) é sempre parâmetro.
 *
 * - **Regras**: para cada tipo de evento (RF04, inclusive o pseudo-evento de fim da validade), se
 *   avisa e com quantos dias de antecedência (0 = no dia). Há um padrão ({@link REGRAS_PADRAO});
 *   o usuário personaliza tipo a tipo, e o que ele não mudou segue o padrão ({@link mesclarRegras}).
 * - **Disparo sem cron**: as notificações são calculadas sob demanda a partir dos eventos
 *   pendentes, das regras e de `hoje` ({@link notificacoesDisparadas}). Uma notificação é
 *   identificada pelo par (prazo, antecedência) — a chave não contém a data, então, se o evento
 *   mudar de data (retificação), a notificação acompanha a nova data sem duplicar. Só o estado de
 *   leitura/dispensa é guardado (por usuário).
 */
import { type DataISO, diasEntre, ehDataISO, somarDias } from "../lib/tz";
import { TIPO_EVENTO, type TipoEvento } from "./enums";
import { type ConcursoPrazo, concursoAcompanhado, type EventoPrazo, nomePrazo } from "./prazos";

/** Maior antecedência aceita, em dias (a validade costuma ser lembrada com meses de folga). */
export const ANTECEDENCIA_MAXIMA = 365;
/** Máximo de antecedências por tipo de evento. */
export const MAX_ANTECEDENCIAS = 6;

/** Regra de um tipo de evento. `antecedencias` em dias, sem repetição, da maior para a menor. */
export interface RegraNotificacao {
  tipo: TipoEvento;
  ativo: boolean;
  antecedencias: number[];
}

export type RegrasNotificacao = Readonly<Record<TipoEvento, RegraNotificacao>>;

const regra = (tipo: TipoEvento, ativo: boolean, antecedencias: number[]): RegraNotificacao => ({
  tipo,
  ativo,
  antecedencias,
});

/**
 * Padrão (issue #65): fim de inscrição em 7, 1 e 0 dias; isenção e boleto em 2 e 0; provas e
 * demais fases em 7 e 1; recursos em 1 e 0; convocação, nomeação e posse em 3 e 0; fim da
 * validade em 90 e 30 (o alerta de validade do app começa em 90 dias). Os demais tipos começam
 * desligados, com aviso no dia, para quem quiser ligá-los.
 */
export const REGRAS_PADRAO: RegrasNotificacao = {
  PUBLICACAO_EDITAL: regra("PUBLICACAO_EDITAL", false, [0]),
  INICIO_INSCRICOES: regra("INICIO_INSCRICOES", false, [0]),
  FIM_INSCRICOES: regra("FIM_INSCRICOES", true, [7, 1, 0]),
  PEDIDO_ISENCAO: regra("PEDIDO_ISENCAO", true, [2, 0]),
  VENCIMENTO_BOLETO: regra("VENCIMENTO_BOLETO", true, [2, 0]),
  PROVA_OBJETIVA: regra("PROVA_OBJETIVA", true, [7, 1]),
  PROVA_DISCURSIVA: regra("PROVA_DISCURSIVA", true, [7, 1]),
  OUTRA_FASE: regra("OUTRA_FASE", true, [7, 1]),
  GABARITO_PRELIMINAR: regra("GABARITO_PRELIMINAR", false, [0]),
  PRAZO_RECURSO: regra("PRAZO_RECURSO", true, [1, 0]),
  RESULTADO_FINAL: regra("RESULTADO_FINAL", false, [0]),
  HOMOLOGACAO: regra("HOMOLOGACAO", false, [0]),
  CONVOCACAO: regra("CONVOCACAO", true, [3, 0]),
  NOMEACAO: regra("NOMEACAO", true, [3, 0]),
  POSSE: regra("POSSE", true, [3, 0]),
  VALIDADE: regra("VALIDADE", true, [90, 30]),
  OUTRO: regra("OUTRO", false, [0]),
};

/** `true` se `dias` é uma antecedência aceita (inteiro de 0 a {@link ANTECEDENCIA_MAXIMA}). */
export function ehAntecedencia(dias: number): boolean {
  return Number.isInteger(dias) && dias >= 0 && dias <= ANTECEDENCIA_MAXIMA;
}

/** Antecedências sem repetição, da maior para a menor (formato guardado e exibido). */
export function normalizarAntecedencias(dias: readonly number[]): number[] {
  return [...new Set(dias)].sort((a, b) => b - a);
}

/**
 * Lê antecedências digitadas ("7, 1, 0" ou "7 1 0"). Devolve a lista normalizada ou uma
 * mensagem de erro em pt-BR.
 */
export function lerAntecedencias(
  texto: string,
): { ok: true; dias: number[] } | { ok: false; erro: string } {
  const partes = texto
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return { ok: false, erro: "Informe ao menos uma antecedência." };
  const dias: number[] = [];
  for (const p of partes) {
    const n = /^\d+$/.test(p) ? Number(p) : Number.NaN;
    if (!ehAntecedencia(n)) {
      return {
        ok: false,
        erro: `"${p}" não é uma antecedência válida (dias de 0 a ${ANTECEDENCIA_MAXIMA}).`,
      };
    }
    dias.push(n);
  }
  const normalizadas = normalizarAntecedencias(dias);
  if (normalizadas.length > MAX_ANTECEDENCIAS) {
    return { ok: false, erro: `Use no máximo ${MAX_ANTECEDENCIAS} antecedências.` };
  }
  return { ok: true, dias: normalizadas };
}

/** Texto das antecedências para edição: "7, 1, 0". */
export function formatarAntecedencias(dias: readonly number[]): string {
  return dias.join(", ");
}

/** Descrição de uma antecedência: "no dia", "1 dia antes", "7 dias antes". */
export function descreverAntecedencia(dias: number): string {
  if (dias === 0) return "no dia";
  return dias === 1 ? "1 dia antes" : `${dias} dias antes`;
}

/**
 * Regras efetivas: o padrão, sobrescrito tipo a tipo pelas personalizações do usuário. Itens
 * com tipo desconhecido ou antecedências inválidas são ignorados (seguem o padrão).
 */
export function mesclarRegras(personalizadas: readonly RegraNotificacao[] = []): RegrasNotificacao {
  const regras: Record<TipoEvento, RegraNotificacao> = { ...REGRAS_PADRAO };
  for (const r of personalizadas) {
    if (!(TIPO_EVENTO as readonly string[]).includes(r.tipo)) continue;
    const antecedencias = normalizarAntecedencias(r.antecedencias);
    if (
      antecedencias.length === 0 ||
      antecedencias.length > MAX_ANTECEDENCIAS ||
      !antecedencias.every(ehAntecedencia)
    ) {
      continue;
    }
    regras[r.tipo] = { tipo: r.tipo, ativo: r.ativo, antecedencias };
  }
  return regras;
}

/** `true` se a regra é igual à do padrão (não precisa ser guardada). */
export function ehRegraPadrao(r: RegraNotificacao): boolean {
  const padrao = REGRAS_PADRAO[r.tipo];
  const a = normalizarAntecedencias(r.antecedencias);
  return (
    r.ativo === padrao.ativo &&
    a.length === padrao.antecedencias.length &&
    a.every((d, i) => d === padrao.antecedencias[i])
  );
}

/** Concurso para o cálculo: o de prazos mais o silenciamento por concurso. */
export interface ConcursoNotificavel extends ConcursoPrazo {
  /** Concurso silenciado pelo usuário: não gera notificações nem alarmes. */
  notificacoesSilenciadas?: boolean;
}

/** Estado guardado de uma notificação. */
export interface EstadoNotificacao {
  lida: boolean;
  dispensada: boolean;
}

export interface Notificacao<
  E extends EventoPrazo = EventoPrazo,
  C extends ConcursoNotificavel = ConcursoNotificavel,
> {
  /** Identidade estável: `<chave do prazo>:<antecedência>` (ex.: `evento-12:7`, `validade-3:30`). */
  chave: string;
  /** Chave do prazo de origem (`evento-<id>` ou `validade-<concursoId>`). */
  chavePrazo: string;
  /** Evento de origem; `null` para o pseudo-evento de validade. */
  evento: E | null;
  concurso: C;
  tipo: TipoEvento;
  /** Nome do prazo: título do evento, rótulo do tipo ou "Fim da validade do concurso". */
  nome: string;
  /** Texto do aviso: "Fim das inscrições é hoje", "Prova objetiva em 7 dias". */
  mensagem: string;
  data: DataISO;
  hora: string | null;
  /** Dias de `hoje` até `data` (0 = hoje). */
  dias: number;
  /** Antecedência da regra que disparou. */
  antecedencia: number;
  /** Dia em que a notificação passou a valer (`data - antecedência`). */
  disparadaEm: DataISO;
  lida: boolean;
}

/** Monta a chave da notificação a partir da chave do prazo e da antecedência. */
export function chaveNotificacao(chavePrazo: string, antecedencia: number): string {
  return `${chavePrazo}:${antecedencia}`;
}

export type AlvoNotificacao =
  | { tipo: "evento"; eventoId: number; antecedencia: number }
  | { tipo: "validade"; concursoId: number; antecedencia: number };

/** Interpreta a chave da notificação; `null` se inválida. */
export function lerChaveNotificacao(chave: unknown): AlvoNotificacao | null {
  if (typeof chave !== "string") return null;
  const m = /^(evento|validade)-([1-9]\d{0,15}):(\d{1,3})$/.exec(chave);
  if (!m) return null;
  const id = Number(m[2]);
  const antecedencia = Number(m[3]);
  if (!Number.isSafeInteger(id) || !ehAntecedencia(antecedencia)) return null;
  return m[1] === "evento"
    ? { tipo: "evento", eventoId: id, antecedencia }
    : { tipo: "validade", concursoId: id, antecedencia };
}

function mensagem(nome: string, dias: number): string {
  if (dias === 0) return `${nome} é hoje`;
  if (dias === 1) return `${nome} é amanhã`;
  return `${nome} em ${dias} dias`;
}

/**
 * Antecedência que vale hoje para um prazo a `dias` dias: a menor antecedência ≥ `dias` (a mais
 * recente já alcançada). Assim, quem abre o app só na véspera vê um aviso só ("amanhã"), não
 * também os de 7 e 2 dias. `null` se nenhuma foi alcançada ainda.
 */
export function antecedenciaVigente(antecedencias: readonly number[], dias: number): number | null {
  let vigente: number | null = null;
  for (const a of antecedencias) {
    if (a >= dias && (vigente === null || a < vigente)) vigente = a;
  }
  return vigente;
}

interface PrazoCandidato<E, C> {
  chavePrazo: string;
  evento: E | null;
  concurso: C;
  tipo: TipoEvento;
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  derivado: boolean;
}

/**
 * Notificações disparadas em `hoje`, das mais recentes para as mais antigas (por dia de disparo,
 * depois pela data do prazo).
 *
 * - Considera eventos não concluídos de concursos acompanhados (ativos) e não silenciados, de
 *   hoje em diante; o fim da validade derivado (§4.3) entra se o concurso não tem evento
 *   `VALIDADE` explícito.
 * - Para cada prazo, no máximo uma notificação: a da antecedência vigente
 *   ({@link antecedenciaVigente}), se o tipo estiver ativo.
 * - `estados` (por chave) marca as lidas e remove as dispensadas.
 */
export function notificacoesDisparadas<E extends EventoPrazo, C extends ConcursoNotificavel>(
  eventos: readonly E[],
  concursos: readonly C[],
  regras: RegrasNotificacao,
  hoje: DataISO,
  estados: ReadonlyMap<string, EstadoNotificacao> = new Map(),
): Notificacao<E, C>[] {
  if (!ehDataISO(hoje)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${hoje}"`);

  const acompanhados = new Map<number, C>();
  for (const c of concursos) {
    if (concursoAcompanhado(c.status) && c.notificacoesSilenciadas !== true) {
      acompanhados.set(c.id, c);
    }
  }

  const candidatos: PrazoCandidato<E, C>[] = [];
  const comValidadeExplicita = new Set<number>();
  for (const e of eventos) {
    if (e.tipo === "VALIDADE") comValidadeExplicita.add(e.concursoId);
    const concurso = acompanhados.get(e.concursoId);
    if (!concurso || e.concluido || !ehDataISO(e.data)) continue;
    candidatos.push({
      chavePrazo: `evento-${e.id}`,
      evento: e,
      concurso,
      tipo: e.tipo,
      titulo: e.titulo,
      data: e.data,
      hora: e.hora,
      derivado: false,
    });
  }
  for (const concurso of acompanhados.values()) {
    const fim = concurso.validadeFim;
    if (!fim || !ehDataISO(fim) || comValidadeExplicita.has(concurso.id)) continue;
    candidatos.push({
      chavePrazo: `validade-${concurso.id}`,
      evento: null,
      concurso,
      tipo: "VALIDADE",
      titulo: null,
      data: fim,
      hora: null,
      derivado: true,
    });
  }

  const notificacoes: Notificacao<E, C>[] = [];
  for (const p of candidatos) {
    const r = regras[p.tipo];
    if (!r.ativo) continue;
    const dias = diasEntre(hoje, p.data);
    if (dias < 0) continue;
    const antecedencia = antecedenciaVigente(r.antecedencias, dias);
    if (antecedencia === null) continue;
    const chave = chaveNotificacao(p.chavePrazo, antecedencia);
    const estado = estados.get(chave);
    if (estado?.dispensada) continue;
    const nome = nomePrazo(p);
    notificacoes.push({
      chave,
      chavePrazo: p.chavePrazo,
      evento: p.evento,
      concurso: p.concurso,
      tipo: p.tipo,
      nome,
      mensagem: mensagem(nome, dias),
      data: p.data,
      hora: p.hora,
      dias,
      antecedencia,
      disparadaEm: somarDias(p.data, -antecedencia),
      lida: estado?.lida === true,
    });
  }

  return notificacoes.sort((a, b) => {
    if (a.disparadaEm !== b.disparadaEm) return a.disparadaEm > b.disparadaEm ? -1 : 1;
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    if (a.hora !== b.hora) {
      if (a.hora === null) return -1;
      if (b.hora === null) return 1;
      return a.hora < b.hora ? -1 : 1;
    }
    return a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0;
  });
}

/** Quantidade de notificações não lidas. */
export function contarNaoLidas(notificacoes: readonly Pick<Notificacao, "lida">[]): number {
  return notificacoes.filter((n) => !n.lida).length;
}
