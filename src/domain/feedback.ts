/**
 * Regras do feedback de usuários (#117): limites do envio, da caixa de entrada do admin e a página
 * anexada ao feedback. Sem dependências: usado pelo formulário (cliente), pelas Server Actions e
 * pelos testes.
 */
import type { TipoFeedback } from "./enums";

export const MENSAGEM_FEEDBACK_MIN = 10;
export const MENSAGEM_FEEDBACK_MAX = 2000;

/** Envios por usuário em {@link JANELA_ENVIOS_MS} (contados no banco: valem entre instâncias). */
export const MAX_ENVIOS_FEEDBACK = 10;
export const JANELA_ENVIOS_MS = 60 * 60_000;

/** Itens por ação em lote do admin (exportar, descartar, restaurar, excluir). */
export const MAX_LOTE_FEEDBACK = 200;

/** Itens por página na caixa de entrada. */
export const FEEDBACKS_POR_PAGINA = 50;

const PAGINA_MAX = 200;
const USER_AGENT_MAX = 300;

export const MENSAGENS_FEEDBACK = {
  limiteEnvios: `Você já enviou ${MAX_ENVIOS_FEEDBACK} feedbacks na última hora. Tente de novo mais tarde.`,
} as const;

/**
 * Página do envio como rota: só o caminho, sem query string nem fragmento (que podem trazer
 * filtros ou buscas), e com os segmentos numéricos trocados por `[id]` (`/concursos/12` →
 * `/concursos/[id]`), porque o export vira issue pública. Fora do formato esperado, `null`.
 */
export function normalizarPagina(entrada: string | null | undefined): string | null {
  const caminho = entrada?.trim().split(/[?#]/, 1)[0] ?? "";
  if (!caminho.startsWith("/") || caminho.startsWith("//")) return null;
  // Só caracteres de caminho; o resto (controle, espaços) invalida.
  if (!/^\/[\w\-./~%@:+,;=!$&'()*]*$/.test(caminho)) return null;
  return caminho
    .split("/")
    .map((segmento) => (/^\d+$/.test(segmento) ? "[id]" : segmento))
    .join("/")
    .slice(0, PAGINA_MAX);
}

/** Troca caracteres de controle por `substituto`; `manter` lista os que ficam (ex.: `"\n\t"`). */
export function semCaracteresDeControle(texto: string, substituto = "", manter = ""): string {
  let r = "";
  for (const c of texto) {
    const codigo = c.codePointAt(0) ?? 0;
    const controle = codigo < 0x20 || codigo === 0x7f;
    r += controle && !manter.includes(c) ? substituto : c;
  }
  return r;
}

/** User agent guardado com o feedback, cortado (vem do cabeçalho, sem confiança). */
export function normalizarUserAgent(entrada: string | null | undefined): string | null {
  const ua = entrada ? semCaracteresDeControle(entrada, " ").trim() : "";
  return ua ? ua.slice(0, USER_AGENT_MAX) : null;
}

/** Rótulo da issue no GitHub por tipo (`gh issue create --label`); `Outro` fica sem rótulo. */
export const LABEL_GITHUB_FEEDBACK: Readonly<Record<TipoFeedback, string | null>> = {
  BUG: "bug",
  SUGESTAO: "enhancement",
  OUTRO: null,
};

/** "1 feedback", "5 feedbacks" (alvo da auditoria e avisos). */
export function quantidadeFeedbacks(n: number): string {
  return `${n} ${n === 1 ? "feedback" : "feedbacks"}`;
}
