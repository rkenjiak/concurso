/**
 * Navegação rápida e filtro de concursos do calendário (#83). Funções puras: sem Next, sem banco
 * e sem relógio — `hoje` (data de calendário em America/Sao_Paulo) é sempre parâmetro.
 *
 * A URL é a fonte da verdade e continua compartilhável:
 * - `?mes=AAAA-MM`: mês exibido (ausente ou inválido = mês de hoje, ver `lerMes`);
 * - `?concursos=1,3`: concursos exibidos, por ID. Ausente = todos; vazio (`?concursos=`) =
 *   nenhum. A seleção acompanha todos os links de navegação entre meses.
 */
import type { DataISO } from "../lib/tz";
import { type MesISO, mesDaData } from "./calendario";
import {
  type Contagem,
  compararContagens,
  contagemRegressiva,
  TIPOS_CONTAGEM_PADRAO,
} from "./contagem";
import type { Status } from "./enums";
import type { EventoChave } from "./eventos-chave";

export const PARAM_MES = "mes";
export const PARAM_CONCURSOS = "concursos";

/** IDs dos concursos exibidos, em ordem crescente e sem repetição; `null` = todos. */
export type SelecaoConcursos = readonly number[] | null;

const RE_ID = /^[1-9]\d{0,15}$/;

/**
 * Seleção pedida na URL (`?concursos=1,3`). Ausente = todos (`null`); vazia = nenhum (`[]`).
 * IDs inválidos são ignorados; se nenhum for válido num valor não vazio, vale "todos" (URL
 * malformada não deve esconder o calendário inteiro).
 */
export function lerSelecaoConcursos(valor: unknown): SelecaoConcursos {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (typeof texto !== "string") return null;
  if (texto.trim() === "") return [];
  const ids = texto
    .split(",")
    .map((t) => t.trim())
    .filter((t) => RE_ID.test(t))
    .map(Number)
    .filter(Number.isSafeInteger);
  return ids.length === 0 ? null : ordenarIds(ids);
}

function ordenarIds(ids: Iterable<number>): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Restringe a seleção aos concursos existentes (`todos`). Se sobrarem todos, volta a `null`, para
 * a URL ficar limpa e concursos cadastrados depois também aparecerem.
 */
export function normalizarSelecao(
  selecao: SelecaoConcursos,
  todos: readonly number[],
): SelecaoConcursos {
  if (selecao === null) return null;
  const existentes = new Set(todos);
  const ids = ordenarIds(selecao.filter((id) => existentes.has(id)));
  if (existentes.size > 0 && ids.length === existentes.size) return null;
  // Seleção só com IDs que não existem mais (concursos excluídos): mostra todos.
  if (ids.length === 0 && selecao.length > 0) return null;
  return ids;
}

/** Valor de `?concursos=` (`null` = parâmetro ausente). */
export function serializarSelecao(selecao: SelecaoConcursos): string | null {
  return selecao === null ? null : ordenarIds(selecao).join(",");
}

export function concursoVisivel(selecao: SelecaoConcursos, id: number): boolean {
  return selecao === null || selecao.includes(id);
}

export function filtrarPorSelecao<T extends { concurso: { id: number } }>(
  itens: readonly T[],
  selecao: SelecaoConcursos,
): T[] {
  return selecao === null
    ? [...itens]
    : itens.filter((i) => concursoVisivel(selecao, i.concurso.id));
}

/** Liga/desliga um concurso. Partindo de "todos", desligar mostra os demais de `todos`. */
export function alternarConcurso(
  selecao: SelecaoConcursos,
  id: number,
  todos: readonly number[],
): SelecaoConcursos {
  const atual = selecao ?? todos;
  const proxima = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
  return normalizarSelecao(proxima, todos);
}

/** Link do calendário com o mês e a seleção (vírgulas legíveis, sem `%2C`). */
export function hrefCalendario(mes: MesISO, selecao: SelecaoConcursos = null): string {
  const params = [`${PARAM_MES}=${mes}`];
  const concursos = serializarSelecao(selecao);
  if (concursos !== null) params.push(`${PARAM_CONCURSOS}=${concursos}`);
  return `/calendario?${params.join("&")}`;
}

/** Quantidade de itens por mês (`AAAA-MM`). */
export function contarPorMes(itens: readonly { data: DataISO }[]): Map<MesISO, number> {
  const contagens = new Map<MesISO, number>();
  for (const { data } of itens) {
    const mes = mesDaData(data);
    contagens.set(mes, (contagens.get(mes) ?? 0) + 1);
  }
  return contagens;
}

/** Primeiro mês depois de `mes` com ao menos um item; `null` se não houver. */
export function proximoMesComEventos(
  contagens: ReadonlyMap<MesISO, number>,
  mes: MesISO,
): MesISO | null {
  let proximo: MesISO | null = null;
  for (const [m, n] of contagens) {
    if (n > 0 && m > mes && (proximo === null || m < proximo)) proximo = m;
  }
  return proximo;
}

/** Item mínimo para achar a próxima prova: evento real (não derivado) e status do concurso. */
interface ItemComEvento {
  evento: EventoChave | null;
  concurso: { id: number; status: Status };
}

export interface ProximaProva<T> {
  item: T;
  contagem: Contagem;
}

/**
 * Próxima prova entre os itens (todas as datas), pela mesma regra da contagem regressiva (#84):
 * provas e outras fases, não concluídas, de hoje em diante, de concursos em andamento.
 */
export function proximaProva<T extends ItemComEvento>(
  itens: readonly T[],
  hoje: DataISO,
): ProximaProva<T> | null {
  const porConcurso = new Map<number, { status: Status; itens: T[] }>();
  for (const item of itens) {
    if (!item.evento) continue;
    const grupo = porConcurso.get(item.concurso.id);
    if (grupo) grupo.itens.push(item);
    else porConcurso.set(item.concurso.id, { status: item.concurso.status, itens: [item] });
  }
  const candidatas: { concursoId: number; contagem: Contagem; item: T }[] = [];
  for (const [concursoId, grupo] of porConcurso) {
    const eventos = grupo.itens.flatMap((i) => (i.evento ? [i.evento] : []));
    const contagem = contagemRegressiva(grupo.status, eventos, hoje, TIPOS_CONTAGEM_PADRAO);
    if (!contagem) continue;
    const item = grupo.itens.find((i) => i.evento === contagem.evento);
    if (item) candidatas.push({ concursoId, contagem, item });
  }
  const [primeira] = candidatas.sort(compararContagens);
  return primeira ? { item: primeira.item, contagem: primeira.contagem } : null;
}

/** Abreviações dos meses, de janeiro a dezembro. */
export const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** Os 12 meses (`AAAA-MM`) de um ano. */
export function mesesDoAno(ano: number): MesISO[] {
  return MESES_CURTOS.map((_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
}

/** "1 evento", "3 eventos", "nenhum evento". */
export function textoQuantidadeEventos(n: number): string {
  if (n === 0) return "nenhum evento";
  return n === 1 ? "1 evento" : `${n} eventos`;
}

/** Recorte dos itens (de qualquer data) no mês `AAAA-MM`, preservando a ordem. */
export function itensDoMes<T extends { data: DataISO }>(itens: readonly T[], mes: MesISO): T[] {
  return itens.filter((i) => mesDaData(i.data) === mes);
}
