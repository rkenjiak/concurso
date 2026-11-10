/**
 * Validação do feedback de usuários (#117): o envio (formulário e Server Action) e as ações em lote
 * do admin.
 */
import { z } from "zod";
import { STATUS_FEEDBACK, TIPO_FEEDBACK } from "@/domain/enums";
import {
  MAX_LOTE_FEEDBACK,
  MENSAGEM_FEEDBACK_MAX,
  MENSAGEM_FEEDBACK_MIN,
  normalizarPagina,
} from "@/domain/feedback";

export const feedbackSchema = z.object({
  tipo: z.enum(TIPO_FEEDBACK, { error: "Escolha o tipo." }),
  mensagem: z
    .string({ error: "Escreva a mensagem." })
    .trim()
    .min(MENSAGEM_FEEDBACK_MIN, `Escreva pelo menos ${MENSAGEM_FEEDBACK_MIN} caracteres.`)
    .max(MENSAGEM_FEEDBACK_MAX, `Use no máximo ${MENSAGEM_FEEDBACK_MAX} caracteres.`),
  /** Página do envio: normalizada (sem query string); inválida vira `null`, sem recusar o envio. */
  pagina: z
    .string()
    .nullish()
    .transform((p) => normalizarPagina(p)),
});
export type FeedbackEntrada = z.output<typeof feedbackSchema>;

/** IDs de uma ação em lote: inteiros positivos, sem repetição, até {@link MAX_LOTE_FEEDBACK}. */
export const idsFeedbackSchema = z
  .array(z.number().int().positive(), { error: "Seleção inválida." })
  .min(1, "Selecione ao menos um feedback.")
  .max(MAX_LOTE_FEEDBACK, `Selecione no máximo ${MAX_LOTE_FEEDBACK} feedbacks por vez.`)
  .transform((ids) => [...new Set(ids)]);

export const FORMATO_EXPORTACAO_FEEDBACK = [
  "MARKDOWN_ISSUES",
  "MARKDOWN_AGRUPADO",
  "JSON",
  "GH",
] as const;
export type FormatoExportacaoFeedback = (typeof FORMATO_EXPORTACAO_FEEDBACK)[number];

export const formatoExportacaoSchema = z.enum(FORMATO_EXPORTACAO_FEEDBACK, {
  error: "Formato inválido.",
});

/** Desfazer um descarte: cada item volta ao status que tinha (nunca a `DESCARTADO`). */
export const anterioresFeedbackSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      status: z.enum(STATUS_FEEDBACK).exclude(["DESCARTADO"]),
    }),
    { error: "Seleção inválida." },
  )
  .min(1, "Selecione ao menos um feedback.")
  .max(MAX_LOTE_FEEDBACK, `Selecione no máximo ${MAX_LOTE_FEEDBACK} feedbacks por vez.`);

/** Filtro de status da caixa de entrada (`TODOS` = sem filtro). */
export const FILTRO_STATUS_FEEDBACK = ["NOVO", "EXPORTADO", "DESCARTADO", "TODOS"] as const;
export type FiltroStatusFeedback = (typeof FILTRO_STATUS_FEEDBACK)[number];

export interface FiltrosCaixaFeedback {
  status: FiltroStatusFeedback;
  tipo: (typeof TIPO_FEEDBACK)[number] | null;
  busca: string;
  pagina: number;
}

type Parametros = Record<string, string | string[] | undefined>;
const primeiro = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filtros da caixa de entrada a partir da URL (valores inválidos voltam ao padrão). */
export function lerFiltrosFeedback(parametros: Parametros): FiltrosCaixaFeedback {
  const status = primeiro(parametros.status)?.toUpperCase();
  const tipo = primeiro(parametros.tipo)?.toUpperCase();
  const pagina = Number.parseInt(primeiro(parametros.pagina) ?? "", 10);
  return {
    status: (FILTRO_STATUS_FEEDBACK as readonly string[]).includes(status ?? "")
      ? (status as FiltroStatusFeedback)
      : "NOVO",
    tipo: (TIPO_FEEDBACK as readonly string[]).includes(tipo ?? "")
      ? (tipo as FiltrosCaixaFeedback["tipo"])
      : null,
    busca: (primeiro(parametros.busca) ?? "").trim().slice(0, 100),
    pagina: Number.isSafeInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** URL canônica da caixa de entrada (sem parâmetros no valor padrão). */
export function hrefFeedback(filtros: Partial<FiltrosCaixaFeedback>): string {
  const p = new URLSearchParams();
  if (filtros.status && filtros.status !== "NOVO") p.set("status", filtros.status.toLowerCase());
  if (filtros.tipo) p.set("tipo", filtros.tipo.toLowerCase());
  if (filtros.busca) p.set("busca", filtros.busca);
  if (filtros.pagina && filtros.pagina > 1) p.set("pagina", String(filtros.pagina));
  const consulta = p.toString();
  return consulta ? `/admin/feedback?${consulta}` : "/admin/feedback";
}
