/**
 * Entradas das ferramentas MCP. Os schemas daqui descrevem o JSON que a LLM envia (números em
 * reais, `null` para limpar, campos omitidos = manter) e geram o JSON Schema anunciado ao cliente;
 * não validam regras de negócio. Os conversores transformam essas entradas nos valores crus dos
 * formulários, que passam pelos MESMOS schemas Zod da UI (`src/lib/schemas/*`) antes de gravar.
 */
import { z } from "zod";
import {
  ESCOLARIDADE,
  ESFERA,
  FASE,
  SITUACAO_FASE,
  STATUS,
  TIPO_EVENTO,
  TIPO_LINK,
  UF,
} from "@/domain/enums";
import { centavosParaEntrada, notaParaEntrada } from "@/lib/format";
import type { ConcursoFormValores } from "@/lib/schemas/concurso";
import type { EventoFormValores } from "@/lib/schemas/evento";
import type { LinkFormValores } from "@/lib/schemas/link";
import type { ResultadoFaseFormValores } from "@/lib/schemas/resultado-fase";

const id = (descricao: string) => z.number().int().positive().describe(descricao);
const textoOpc = (descricao: string) => z.string().nullish().describe(descricao);
const inteiroOpc = (descricao: string) => z.number().int().nullish().describe(descricao);
const numeroOpc = (descricao: string) => z.number().nullish().describe(descricao);
const dataOpc = (descricao: string) =>
  z.string().nullish().describe(`${descricao} Formato AAAA-MM-DD.`);

// ---------------------------------------------------------------------------------------------
// Concurso
// ---------------------------------------------------------------------------------------------

const camposConcurso = {
  orgao: z
    .string()
    .describe("Órgão ou instituição, por extenso (ex.: 'Tribunal Regional Federal da 3ª Região')."),
  cargo: z
    .string()
    .describe(
      "UM cargo — o escolhido pelo usuário —, com a especialidade/área quando houver " +
        "(ex.: 'Analista Judiciário – Área Judiciária').",
    ),
  banca: textoOpc("Banca organizadora (ex.: 'FCC', 'Cebraspe')."),
  esfera: z.enum(ESFERA).nullish().describe("Esfera do órgão."),
  uf: z.enum(UF).nullish().describe("UF (sigla) do órgão ou da lotação."),
  cidade: textoOpc("Cidade da lotação ou da prova, se única."),
  escolaridade: z.enum(ESCOLARIDADE).nullish().describe("Escolaridade exigida PARA O CARGO."),
  remuneracao: numeroOpc("Remuneração inicial DO CARGO em reais (ex.: 13994.78)."),
  taxaInscricao: numeroOpc("Taxa de inscrição DO CARGO em reais (ex.: 85)."),
  vagasAmpla: inteiroOpc("Vagas imediatas de ampla concorrência DO CARGO."),
  vagasCotas: inteiroOpc("Total de vagas reservadas (PcD, negros, indígenas etc.) DO CARGO."),
  vagasCadastroReserva: inteiroOpc("Quantidade de vagas de cadastro de reserva, se informada."),
  possuiCadastroReserva: z
    .boolean()
    .optional()
    .describe("Se o edital prevê cadastro de reserva para o cargo."),
  observacoes: textoOpc(
    "Anotações em Markdown: requisitos, atribuições, jornada, lotação, fases/provas e pesos, " +
      "conteúdo programático resumido, critérios de desempate, onde está cada informação no edital.",
  ),
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags livres (ex.: 'tribunais', 'nível superior'). Substituem as atuais."),
  homologacaoData: dataOpc("Data da homologação do resultado final."),
  validadeMeses: inteiroOpc("Prazo de validade do concurso em meses (1 a 24)."),
  validadeProrrogada: z.boolean().optional().describe("Se a validade já foi prorrogada."),
  validadeFimManual: dataOpc("Fim da validade, quando publicado explicitamente."),
};

export const concursoNovoEntrada = z.object({
  ...camposConcurso,
  status: z
    .enum(STATUS)
    .optional()
    .describe(
      "Status inicial. Padrão: EDITAL_PUBLICADO (há edital). Use INSCRITO se o usuário já se inscreveu.",
    ),
});

export const concursoParcialEntrada = z.object(camposConcurso).partial();

export type ConcursoNovoEntrada = z.infer<typeof concursoNovoEntrada>;
export type ConcursoParcialEntrada = z.infer<typeof concursoParcialEntrada>;

// ---------------------------------------------------------------------------------------------
// Evento, link e resultado
// ---------------------------------------------------------------------------------------------

const camposEvento = {
  tipo: z.enum(TIPO_EVENTO).describe("Tipo do evento."),
  titulo: textoOpc("Título curto, quando o tipo não basta (ex.: 'Prova discursiva – peça')."),
  data: z.string().describe("Data AAAA-MM-DD (horário de Brasília). Para períodos, a data final."),
  hora: textoOpc("Hora HH:mm (horário de Brasília), se houver."),
  local: textoOpc("Local ou endereço eletrônico."),
  observacao: textoOpc("Observação (ex.: 'período: 10/03 a 08/04', item do edital)."),
  concluido: z.boolean().optional().describe("Se o evento já aconteceu/foi cumprido."),
};

export const eventoNovoEntrada = z.object(camposEvento);

export const eventoLoteEntrada = z.object({
  id: id("ID do evento a atualizar (omitir para criar um novo).").optional(),
  ...z.object(camposEvento).partial().shape,
});

export const linkNovoEntrada = z.object({
  tipo: z.enum(TIPO_LINK).describe("Tipo do link."),
  rotulo: textoOpc("Rótulo (ex.: 'Retificação nº 1')."),
  url: z.string().describe("URL completa, começando com http:// ou https://."),
});

export const linkLoteEntrada = z.object({
  id: id("ID do link a atualizar (omitir para criar um novo).").optional(),
  ...linkNovoEntrada.partial().shape,
});

export const resultadoEntrada = z.object({
  id: id("ID do resultado a atualizar (omitir para criar).").optional(),
  fase: z.enum(FASE).optional().describe("Fase. Obrigatória ao criar."),
  descricao: textoOpc("Descrição da fase (ex.: 'Prova objetiva – conhecimentos específicos')."),
  nota: numeroOpc("Nota obtida."),
  notaMaxima: numeroOpc("Nota máxima possível."),
  notaCorte: numeroOpc("Nota de corte."),
  classificacaoGeral: inteiroOpc("Classificação na ampla concorrência (a partir de 1)."),
  classificacaoCotas: inteiroOpc("Classificação na lista de cotas (a partir de 1)."),
  listaCotas: textoOpc("Lista de cotas (ex.: 'PcD', 'Negros')."),
  situacao: z.enum(SITUACAO_FASE).optional().describe("Situação na fase. Padrão: PENDENTE."),
  observacao: textoOpc("Observação."),
});

export type EventoNovoEntrada = z.infer<typeof eventoNovoEntrada>;
export type EventoLoteEntrada = z.infer<typeof eventoLoteEntrada>;
export type LinkNovoEntrada = z.infer<typeof linkNovoEntrada>;
export type LinkLoteEntrada = z.infer<typeof linkLoteEntrada>;
export type ResultadoEntrada = z.infer<typeof resultadoEntrada>;

// ---------------------------------------------------------------------------------------------
// Conversão para os valores crus dos formulários
// ---------------------------------------------------------------------------------------------

type Conversor = (valor: unknown) => unknown;

/** `null` → "" (limpar); número/texto → texto. */
const texto: Conversor = (v) => (v == null ? "" : String(v));
/** Reais (número) → texto do campo de moeda ("1.234,56"). */
const moeda: Conversor = (v) =>
  typeof v === "number" ? centavosParaEntrada(Math.round(v * 100)) : texto(v);
/** Decimal (número) → texto do campo de nota ("72,5"). */
const decimal: Conversor = (v) => (typeof v === "number" && v >= 0 ? notaParaEntrada(v) : texto(v));
/** Enum opcional: `null` → "". */
const enumOpc: Conversor = (v) => v ?? "";
/** Booleano: `null` → `false`. */
const booleano: Conversor = (v) => v ?? false;
/** Valor já no formato do formulário. */
const direto: Conversor = (v) => v;

/**
 * Sobrepõe à `base` os campos presentes em `entrada` (omitidos = mantidos), convertidos para o
 * formato do formulário. Campos sem conversor (ex.: `id`) são ignorados.
 */
function mesclar<T extends object>(
  base: T,
  entrada: object,
  conversores: Partial<Record<keyof T, Conversor>>,
): T {
  const resultado = { ...base } as Record<string, unknown>;
  for (const [campo, valor] of Object.entries(entrada)) {
    const converter = conversores[campo as keyof T];
    if (converter && valor !== undefined) resultado[campo] = converter(valor);
  }
  return resultado as T;
}

const CONVERSORES_CONCURSO: Partial<Record<keyof ConcursoFormValores, Conversor>> = {
  orgao: texto,
  cargo: texto,
  banca: texto,
  esfera: enumOpc,
  uf: enumOpc,
  cidade: texto,
  escolaridade: enumOpc,
  remuneracao: moeda,
  taxaInscricao: moeda,
  vagasAmpla: texto,
  vagasCotas: texto,
  vagasCadastroReserva: texto,
  possuiCadastroReserva: booleano,
  status: direto,
  observacoes: texto,
  tags: (v) => v ?? [],
  homologacaoData: texto,
  validadeMeses: texto,
  validadeProrrogada: booleano,
  validadeFimManual: texto,
};

const CONVERSORES_EVENTO: Partial<Record<keyof EventoFormValores, Conversor>> = {
  tipo: direto,
  titulo: texto,
  data: texto,
  hora: texto,
  local: texto,
  observacao: texto,
  concluido: booleano,
};

const CONVERSORES_LINK: Partial<Record<keyof LinkFormValores, Conversor>> = {
  tipo: direto,
  rotulo: texto,
  url: texto,
};

const CONVERSORES_RESULTADO: Partial<Record<keyof ResultadoFaseFormValores, Conversor>> = {
  fase: direto,
  descricao: texto,
  nota: decimal,
  notaMaxima: decimal,
  notaCorte: decimal,
  classificacaoGeral: texto,
  classificacaoCotas: texto,
  listaCotas: texto,
  situacao: direto,
  observacao: texto,
};

export const valoresConcurso = (base: ConcursoFormValores, entrada: object) =>
  mesclar(base, entrada, CONVERSORES_CONCURSO);
export const valoresEvento = (base: EventoFormValores, entrada: object) =>
  mesclar(base, entrada, CONVERSORES_EVENTO);
export const valoresLink = (base: LinkFormValores, entrada: object) =>
  mesclar(base, entrada, CONVERSORES_LINK);
export const valoresResultado = (base: ResultadoFaseFormValores, entrada: object) =>
  mesclar(base, entrada, CONVERSORES_RESULTADO);
