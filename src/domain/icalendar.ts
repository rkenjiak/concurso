/**
 * Exportação dos eventos para calendário (RF08, #65): iCalendar (RFC 5545). Funções puras: sem
 * Next, sem banco e sem relógio — o instante da geração (`DTSTAMP`) é parâmetro.
 *
 * - Evento sem hora: dia inteiro (`DTSTART;VALUE=DATE`, `DTEND` no dia seguinte).
 * - Evento com hora: convertido do horário de Brasília para UTC (`…Z`), com 1 h de duração. UTC
 *   dispensa o `VTIMEZONE` e respeita o histórico do fuso (inclusive o antigo horário de verão).
 * - `UID` estável por prazo (`evento-<id>@<host>` / `validade-<concursoId>@<host>`): o calendário
 *   assinado atualiza o mesmo evento quando a data muda, sem duplicar.
 * - `VALARM` nos prazos críticos pendentes, com as antecedências das regras de notificação do
 *   usuário ({@link alarmesDoPrazo}).
 * - Texto escapado (`\`, `;`, `,`, quebras de linha) e linhas dobradas em 75 octetos (UTF-8),
 *   terminadas em CRLF.
 */
import { type DataISO, ehDataISO, instanteSP, somarDias } from "../lib/tz";
import type { TipoEvento } from "./enums";
import { ROTULO_TIPO_EVENTO } from "./labels";
import { type ConcursoNotificavel, nomeDoPrazo, type RegrasNotificacao } from "./notificacoes";
import { concursoAcompanhado, type EventoPrazo, ehTipoCritico } from "./prazos";

/** Duração atribuída a eventos com hora (o app não guarda o horário de término). */
export const DURACAO_EVENTO_MIN = 60;
/** Hora (Brasília) do alarme de eventos de dia inteiro: 9h do dia do aviso. */
export const HORA_ALARME_DIA_INTEIRO = 9;
/** Antecedência do alarme "no dia" de eventos com hora. */
export const ALARME_NO_DIA_MIN = 120;
/** Intervalo de atualização sugerido aos clientes que assinam o feed. */
export const INTERVALO_ATUALIZACAO = "PT4H";

const CRLF = "\r\n";

/** Escapa um valor do tipo TEXT (RFC 5545 §3.3.11). */
export function escaparTexto(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const bytesUtf8 = (codePoint: number) =>
  codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;

/**
 * Dobra uma linha de conteúdo em partes de até 75 octetos (RFC 5545 §3.1): as continuações
 * começam com um espaço. Nunca corta um caractere UTF-8 ao meio.
 */
export function dobrarLinha(linha: string): string {
  const partes: string[] = [];
  let atual = "";
  let tamanho = 0;
  let limite = 75;
  for (const c of linha) {
    const n = bytesUtf8(c.codePointAt(0) as number);
    if (tamanho + n > limite) {
      partes.push(atual);
      atual = "";
      tamanho = 0;
      limite = 74; // o espaço inicial da continuação conta no limite de 75
    }
    atual += c;
    tamanho += n;
  }
  partes.push(atual);
  return partes.join(`${CRLF} `);
}

const dois = (n: number) => String(n).padStart(2, "0");

/** Instante em UTC no formato `AAAAMMDDTHHMMSSZ`. */
export function formatarUtc(instante: Date): string {
  return (
    `${instante.getUTCFullYear()}${dois(instante.getUTCMonth() + 1)}${dois(instante.getUTCDate())}` +
    `T${dois(instante.getUTCHours())}${dois(instante.getUTCMinutes())}${dois(instante.getUTCSeconds())}Z`
  );
}

/** Data de calendário no formato `AAAAMMDD`. */
export function formatarDataIcs(data: DataISO): string {
  return data.replaceAll("-", "");
}

/** Duração em minutos (negativa = antes) no formato do `TRIGGER`: `-P7D`, `-PT2H`, `-P6DT15H`. */
export function formatarDuracao(minutos: number): string {
  if (!Number.isInteger(minutos)) throw new RangeError(`Duração inválida: ${minutos}`);
  if (minutos === 0) return "PT0S";
  const sinal = minutos < 0 ? "-" : "";
  let resto = Math.abs(minutos);
  const dias = Math.floor(resto / 1440);
  resto -= dias * 1440;
  const horas = Math.floor(resto / 60);
  const min = resto - horas * 60;
  const tempo = `${horas ? `${horas}H` : ""}${min ? `${min}M` : ""}`;
  return `${sinal}P${dias ? `${dias}D` : ""}${tempo ? `T${tempo}` : ""}`;
}

/** Evento pronto para o iCalendar. */
export interface EventoIcs {
  uid: string;
  /** `YYYY-MM-DD` (Brasília). */
  data: DataISO;
  /** `HH:mm` (Brasília) ou `null` (dia inteiro). */
  hora: string | null;
  resumo: string;
  local?: string | null;
  descricao?: string | null;
  url?: string | null;
  ultimaAlteracao?: Date | null;
  /** Antecedências dos alarmes, em dias (0 = no dia). */
  alarmes?: readonly number[];
}

export interface CalendarioIcs {
  nome: string;
  descricao?: string;
  eventos: readonly EventoIcs[];
}

/**
 * Deslocamento do `TRIGGER` (relativo ao início) para um alarme `dias` antes: em eventos de dia
 * inteiro, às 9h do dia do aviso; em eventos com hora, no mesmo horário `dias` antes ou, no dia,
 * 2 h antes.
 */
export function deslocamentoAlarme(dias: number, comHora: boolean): number {
  if (comHora) return dias === 0 ? -ALARME_NO_DIA_MIN : -dias * 1440;
  return -dias * 1440 + HORA_ALARME_DIA_INTEIRO * 60;
}

function linhasEvento(e: EventoIcs, agora: Date): string[] {
  const linhas = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${formatarUtc(agora)}`];
  if (e.hora) {
    const inicio = instanteSP(e.data, e.hora);
    linhas.push(
      `DTSTART:${formatarUtc(inicio)}`,
      `DTEND:${formatarUtc(new Date(inicio.getTime() + DURACAO_EVENTO_MIN * 60_000))}`,
      "TRANSP:OPAQUE",
    );
  } else {
    linhas.push(
      `DTSTART;VALUE=DATE:${formatarDataIcs(e.data)}`,
      `DTEND;VALUE=DATE:${formatarDataIcs(somarDias(e.data, 1))}`,
      "TRANSP:TRANSPARENT",
    );
  }
  linhas.push(`SUMMARY:${escaparTexto(e.resumo)}`);
  if (e.local) linhas.push(`LOCATION:${escaparTexto(e.local)}`);
  if (e.descricao) linhas.push(`DESCRIPTION:${escaparTexto(e.descricao)}`);
  if (e.url) linhas.push(`URL:${e.url.replace(/[\r\n]/g, "")}`);
  if (e.ultimaAlteracao) linhas.push(`LAST-MODIFIED:${formatarUtc(e.ultimaAlteracao)}`);
  for (const dias of [...new Set(e.alarmes ?? [])].sort((a, b) => b - a)) {
    linhas.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escaparTexto(e.resumo)}`,
      `TRIGGER:${formatarDuracao(deslocamentoAlarme(dias, e.hora !== null))}`,
      "END:VALARM",
    );
  }
  linhas.push("END:VEVENT");
  return linhas;
}

/** Gera o arquivo `.ics` (CRLF, linhas dobradas). `agora` vira o `DTSTAMP` de cada evento. */
export function gerarIcs(calendario: CalendarioIcs, agora: Date): string {
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//concurso//Lembretes de concursos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparTexto(calendario.nome)}`,
    ...(calendario.descricao ? [`X-WR-CALDESC:${escaparTexto(calendario.descricao)}`] : []),
    "X-WR-TIMEZONE:America/Sao_Paulo",
    `REFRESH-INTERVAL;VALUE=DURATION:${INTERVALO_ATUALIZACAO}`,
    `X-PUBLISHED-TTL:${INTERVALO_ATUALIZACAO}`,
  ];
  for (const e of calendario.eventos) linhas.push(...linhasEvento(e, agora));
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrarLinha).join(CRLF) + CRLF;
}

// --- Montagem a partir dos dados do app ---------------------------------------------------

/** Evento do app com os campos usados no calendário. */
export interface EventoCalendario extends EventoPrazo {
  local?: string | null;
  observacao?: string | null;
  updatedAt?: Date | null;
}

/** Concurso do app com os campos usados no calendário. */
export interface ConcursoCalendario extends ConcursoNotificavel {
  orgao: string;
  cargo: string;
  icone?: string | null;
  updatedAt?: Date | null;
}

export interface OpcoesCalendario {
  regras: RegrasNotificacao;
  /** Incluir eventos já concluídos (sem alarme). */
  incluirConcluidos: boolean;
  /** Incluir eventos de concursos encerrados (status terminal, sem alarme). */
  incluirEncerrados: boolean;
  /** Origem do app (`https://exemplo.com`), para o link de cada evento e o domínio do `UID`. */
  urlBase: string;
}

/**
 * Antecedências dos alarmes de um prazo: só prazos críticos pendentes de concursos acompanhados e
 * não silenciados, com as antecedências da regra do tipo (se ativa).
 */
export function alarmesDoPrazo(
  tipo: TipoEvento,
  concluido: boolean,
  concurso: ConcursoNotificavel,
  regras: RegrasNotificacao,
): number[] {
  if (concluido || !ehTipoCritico(tipo)) return [];
  if (!concursoAcompanhado(concurso.status) || concurso.notificacoesSilenciadas === true) return [];
  const r = regras[tipo];
  return r.ativo ? [...r.antecedencias] : [];
}

function hostDe(urlBase: string): string {
  try {
    return new URL(urlBase).host || "concurso";
  } catch {
    return "concurso";
  }
}

function descricao(partes: readonly (string | null | undefined | false)[]): string {
  return partes.filter((p): p is string => typeof p === "string" && p.trim() !== "").join("\n\n");
}

/**
 * Eventos do calendário a partir dos eventos e concursos do app (o chamador já filtrou o
 * usuário). Inclui o pseudo-evento de fim da validade (§4.3) dos concursos sem evento `VALIDADE`
 * explícito. Eventos de concursos ausentes em `concursos` ou com data inválida são ignorados.
 * Ordem: data, hora (dia inteiro primeiro) e `UID`.
 */
export function eventosDoCalendario<E extends EventoCalendario, C extends ConcursoCalendario>(
  eventos: readonly E[],
  concursos: readonly C[],
  opcoes: OpcoesCalendario,
): EventoIcs[] {
  const base = opcoes.urlBase.replace(/\/+$/, "");
  const host = hostDe(base);
  const incluidos = new Map<number, C>();
  for (const c of concursos) {
    if (opcoes.incluirEncerrados || concursoAcompanhado(c.status)) incluidos.set(c.id, c);
  }
  const linkConcurso = (c: C) => `${base}/concursos/${c.id}`;
  const nomeConcurso = (c: C) => `${c.orgao} — ${c.cargo}`;
  const resumo = (c: C, nome: string, concluido: boolean) =>
    `${concluido ? "✓ " : ""}${c.icone ? `${c.icone} ` : ""}${nome} — ${c.orgao}`;

  const saida: EventoIcs[] = [];
  const comValidadeExplicita = new Set<number>();
  for (const e of eventos) {
    if (e.tipo === "VALIDADE") comValidadeExplicita.add(e.concursoId);
    const c = incluidos.get(e.concursoId);
    if (!c || !ehDataISO(e.data) || (e.concluido && !opcoes.incluirConcluidos)) continue;
    const nome = nomeDoPrazo({ derivado: false, titulo: e.titulo, tipo: e.tipo });
    saida.push({
      uid: `evento-${e.id}@${host}`,
      data: e.data,
      hora: e.hora,
      resumo: resumo(c, nome, e.concluido),
      local: e.local ?? null,
      descricao: descricao([
        nome !== ROTULO_TIPO_EVENTO[e.tipo] && `Tipo: ${ROTULO_TIPO_EVENTO[e.tipo]}`,
        `Concurso: ${nomeConcurso(c)}`,
        e.observacao,
        e.concluido && "Concluído.",
        `Abrir no app: ${linkConcurso(c)}`,
      ]),
      url: linkConcurso(c),
      ultimaAlteracao: e.updatedAt ?? null,
      alarmes: alarmesDoPrazo(e.tipo, e.concluido, c, opcoes.regras),
    });
  }
  for (const c of incluidos.values()) {
    const fim = c.validadeFim;
    if (!fim || !ehDataISO(fim) || comValidadeExplicita.has(c.id)) continue;
    const nome = nomeDoPrazo({ derivado: true, titulo: null, tipo: "VALIDADE" });
    saida.push({
      uid: `validade-${c.id}@${host}`,
      data: fim,
      hora: null,
      resumo: resumo(c, nome, false),
      descricao: descricao([
        `Concurso: ${nomeConcurso(c)}`,
        "Último dia de validade, calculado a partir da homologação (ou informado no cadastro).",
        `Abrir no app: ${linkConcurso(c)}`,
      ]),
      url: linkConcurso(c),
      ultimaAlteracao: c.updatedAt ?? null,
      alarmes: alarmesDoPrazo("VALIDADE", false, c, opcoes.regras),
    });
  }
  return saida.sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    if (a.hora !== b.hora) {
      if (a.hora === null) return -1;
      if (b.hora === null) return 1;
      return a.hora < b.hora ? -1 : 1;
    }
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });
}
