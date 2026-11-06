/**
 * Busca, filtros e ordenação da lista de concursos (RF07). O estado vive nos `searchParams` da URL
 * (compartilhável): `lerFiltrosConcursos` valida os parâmetros crus com Zod — valores inválidos são
 * ignorados, nunca geram erro — e `filtrosParaBusca` faz o caminho inverso, com URL canônica.
 */
import { z } from "zod";
import {
  ESCOLARIDADE,
  ESFERA,
  type Escolaridade,
  type Esfera,
  STATUS,
  type Status,
  UF,
  type Uf,
} from "@/domain/enums";
import { centavosParaEntrada, parseBRL } from "../format";

export const ORDENACOES = ["proxima_data", "remuneracao", "cadastro", "nome"] as const;
export type Ordenacao = (typeof ORDENACOES)[number];

/** Mais recentes primeiro (comportamento da lista antes dos filtros). */
export const ORDENACAO_PADRAO: Ordenacao = "cadastro";

export const ROTULO_ORDENACAO: Readonly<Record<Ordenacao, string>> = {
  proxima_data: "Próxima data",
  remuneracao: "Maior remuneração",
  cadastro: "Cadastro mais recente",
  nome: "Nome (A–Z)",
};

/** Tamanho máximo do texto de busca (o excedente é descartado). */
export const MAX_BUSCA = 200;

/**
 * Máximo de palavras distintas da busca usadas na consulta (as demais são ignoradas). Cada uma vira
 * um `LIKE` no SQL; sem limite, uma busca enorme estoura a profundidade de expressão do SQLite (#96).
 */
export const MAX_TERMOS_BUSCA = 20;

/** Nomes dos parâmetros na URL. */
export const PARAMS = {
  busca: "q",
  status: "status",
  esfera: "esfera",
  uf: "uf",
  escolaridade: "escolaridade",
  remuneracaoMin: "remMin",
  remuneracaoMax: "remMax",
  ordem: "ordem",
} as const;

export interface FiltrosConcursos {
  /** Texto de busca (trim), ou `null`. */
  busca: string | null;
  /** Status selecionados, na ordem do enum, sem repetição; vazio = todos. */
  status: Status[];
  esfera: Esfera | null;
  uf: Uf | null;
  escolaridade: Escolaridade | null;
  /** Faixa de remuneração em centavos (inclusiva); `min <= max` garantido. */
  remuneracaoMin: number | null;
  remuneracaoMax: number | null;
  ordem: Ordenacao;
}

export const FILTROS_VAZIOS: FiltrosConcursos = {
  busca: null,
  status: [],
  esfera: null,
  uf: null,
  escolaridade: null,
  remuneracaoMin: null,
  remuneracaoMax: null,
  ordem: ORDENACAO_PADRAO,
};

/** Formato de `searchParams` das páginas do App Router. */
export type ParametrosBusca = Readonly<Record<string, string | readonly string[] | undefined>>;

const primeiro = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const enumOuNulo = <const T extends readonly [string, ...string[]]>(valores: T) =>
  z.preprocess(primeiro, z.enum(valores).nullable()).catch(null);

const moeda = z
  .preprocess(primeiro, z.string())
  .transform((v) => parseBRL(v))
  .catch(null);

const parametrosSchema = z.object({
  [PARAMS.busca]: z
    .preprocess(primeiro, z.string())
    .transform((v) => v.trim().slice(0, MAX_BUSCA).trim() || null)
    .catch(null),
  // Aceita repetição (`?status=A&status=B`) e lista separada por vírgula (`?status=A,B`).
  [PARAMS.status]: z
    .preprocess(
      (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
      z.array(z.string()).transform((valores) => {
        const informados = new Set(valores.flatMap((v) => v.split(",")).map((v) => v.trim()));
        return STATUS.filter((s) => informados.has(s));
      }),
    )
    .catch([]),
  [PARAMS.esfera]: enumOuNulo(ESFERA),
  [PARAMS.uf]: z
    .preprocess((v) => {
      const valor = primeiro(v);
      return typeof valor === "string" ? valor.toUpperCase() : valor;
    }, z.enum(UF).nullable())
    .catch(null),
  [PARAMS.escolaridade]: enumOuNulo(ESCOLARIDADE),
  [PARAMS.remuneracaoMin]: moeda,
  [PARAMS.remuneracaoMax]: moeda,
  [PARAMS.ordem]: z.preprocess(primeiro, z.enum(ORDENACOES)).catch(ORDENACAO_PADRAO),
});

/** Valida os `searchParams` da lista; parâmetros ausentes ou inválidos viram "sem filtro". */
export function lerFiltrosConcursos(parametros: ParametrosBusca): FiltrosConcursos {
  const p = parametrosSchema.parse(parametros);
  let min = p[PARAMS.remuneracaoMin];
  let max = p[PARAMS.remuneracaoMax];
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    busca: p[PARAMS.busca],
    status: p[PARAMS.status],
    esfera: p[PARAMS.esfera],
    uf: p[PARAMS.uf],
    escolaridade: p[PARAMS.escolaridade],
    remuneracaoMin: min,
    remuneracaoMax: max,
    ordem: p[PARAMS.ordem],
  };
}

/** Agrupa pares chave/valor (ex.: `FormData`, `URLSearchParams`) no formato de `searchParams`. */
export function parametrosDeEntradas(
  entradas: Iterable<readonly [string, FormDataEntryValue]>,
): Record<string, string[]> {
  const resultado: Record<string, string[]> = {};
  for (const [chave, valor] of entradas) {
    if (typeof valor !== "string") continue;
    const lista = resultado[chave] ?? [];
    lista.push(valor);
    resultado[chave] = lista;
  }
  return resultado;
}

/**
 * Query string canônica (com `?`, ou `""` sem filtros): só parâmetros com valor, ordem padrão
 * omitida, status repetidos na ordem do enum.
 */
export function filtrosParaBusca(filtros: FiltrosConcursos): string {
  const p = new URLSearchParams();
  if (filtros.busca) p.set(PARAMS.busca, filtros.busca);
  for (const s of filtros.status) p.append(PARAMS.status, s);
  if (filtros.esfera) p.set(PARAMS.esfera, filtros.esfera);
  if (filtros.uf) p.set(PARAMS.uf, filtros.uf);
  if (filtros.escolaridade) p.set(PARAMS.escolaridade, filtros.escolaridade);
  if (filtros.remuneracaoMin !== null) {
    p.set(PARAMS.remuneracaoMin, centavosParaEntrada(filtros.remuneracaoMin));
  }
  if (filtros.remuneracaoMax !== null) {
    p.set(PARAMS.remuneracaoMax, centavosParaEntrada(filtros.remuneracaoMax));
  }
  if (filtros.ordem !== ORDENACAO_PADRAO) p.set(PARAMS.ordem, filtros.ordem);
  const texto = p.toString();
  return texto ? `?${texto}` : "";
}

/** Quantidade de filtros ativos além da busca textual e da ordenação (badge "Filtros (n)"). */
export function contarFiltrosAvancados(filtros: FiltrosConcursos): number {
  return (
    (filtros.status.length > 0 ? 1 : 0) +
    [
      filtros.esfera,
      filtros.uf,
      filtros.escolaridade,
      filtros.remuneracaoMin,
      filtros.remuneracaoMax,
    ].filter((v) => v !== null).length
  );
}

/** `true` se algum critério restringe a lista (a ordenação não conta). */
export function temFiltros(filtros: FiltrosConcursos): boolean {
  return filtros.busca !== null || contarFiltrosAvancados(filtros) > 0;
}

/** Visões da página `/concursos`: lista (padrão) ou quadro por status (kanban). */
export const VISOES = ["lista", "quadro"] as const;
export type Visao = (typeof VISOES)[number];

/** Parâmetro da URL que escolhe a visão (`?visao=quadro`); a lista é o padrão e fica omitida. */
export const PARAM_VISAO = "visao";

const visaoSchema = z.preprocess(primeiro, z.enum(VISOES)).catch("lista");

/** Visão escolhida nos `searchParams`; ausente ou inválida = lista. */
export function lerVisao(parametros: ParametrosBusca): Visao {
  return visaoSchema.parse(parametros[PARAM_VISAO]);
}

/** URL canônica de `/concursos` com os filtros e a visão (lista omitida). */
export function hrefConcursos(filtros: FiltrosConcursos, visao: Visao = "lista"): string {
  const busca = filtrosParaBusca(filtros);
  if (visao === "lista") return `/concursos${busca}`;
  return `/concursos${busca ? `${busca}&` : "?"}${PARAM_VISAO}=${visao}`;
}
