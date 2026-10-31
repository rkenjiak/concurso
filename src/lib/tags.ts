/**
 * Lógica pura do campo de tags (RF01), separada do componente para ser testável sem DOM.
 */
import { normalizarTag, normalizarTexto } from "./normalize";

/** Máximo de sugestões exibidas na lista. */
export const MAX_SUGESTOES = 8;

/**
 * Sugestões ainda não adicionadas que contêm o texto digitado (sem acento/maiúsculas).
 * Com texto vazio, devolve as primeiras sugestões disponíveis.
 */
export function filtrarSugestoes(
  sugestoes: readonly string[],
  adicionadas: readonly string[],
  texto: string,
  limite = MAX_SUGESTOES,
): string[] {
  const busca = normalizarTexto(texto);
  return sugestoes
    .filter((s) => !adicionadas.includes(s))
    .filter((s) => busca === "" || normalizarTexto(s).includes(busca))
    .slice(0, limite);
}

/** Tags novas (normalizadas, sem vazias nem repetidas) a partir de um texto com vírgulas. */
export function tagsDoTexto(bruto: string, adicionadas: readonly string[]): string[] {
  const nomes = bruto
    .split(",")
    .map(normalizarTag)
    .filter((n) => n !== "" && !adicionadas.includes(n));
  return [...new Set(nomes)];
}

export interface EstadoTecla {
  key: string;
  /** `true` durante composição de IME (acentos, teclado virtual): a tecla não deve ser tratada. */
  compondo: boolean;
  texto: string;
  /** Quantidade de tags já adicionadas. */
  quantidade: number;
  /** Sugestões visíveis e índice destacado (-1 = nenhum). */
  sugestoes: readonly string[];
  destaque: number;
}

export type AcaoTecla =
  | { tipo: "adicionar"; valor: string }
  | { tipo: "remover-ultima" }
  | { tipo: "destacar"; indice: number }
  | { tipo: "fechar" }
  | { tipo: "nenhuma" };

/**
 * Decide o que fazer com uma tecla no campo de tags. Ações diferentes de `nenhuma` devem
 * chamar `preventDefault` (ex.: Enter não pode enviar o formulário).
 */
export function acaoDaTecla(e: EstadoTecla): AcaoTecla {
  if (e.compondo) return { tipo: "nenhuma" };
  const temTexto = e.texto.trim() !== "";
  const destacada = e.destaque >= 0 ? e.sugestoes[e.destaque] : undefined;
  switch (e.key) {
    case "Enter":
      if (destacada !== undefined) return { tipo: "adicionar", valor: destacada };
      // Enter com texto adiciona; vazio também é absorvido para não enviar o formulário.
      return temTexto ? { tipo: "adicionar", valor: e.texto } : { tipo: "nenhuma" };
    case ",":
      return temTexto ? { tipo: "adicionar", valor: e.texto } : { tipo: "nenhuma" };
    case "Tab":
      if (destacada !== undefined) return { tipo: "adicionar", valor: destacada };
      return temTexto ? { tipo: "adicionar", valor: e.texto } : { tipo: "nenhuma" };
    case "Backspace":
      return e.texto === "" && e.quantidade > 0 ? { tipo: "remover-ultima" } : { tipo: "nenhuma" };
    case "ArrowDown":
      if (e.sugestoes.length === 0) return { tipo: "nenhuma" };
      return { tipo: "destacar", indice: (e.destaque + 1) % e.sugestoes.length };
    case "ArrowUp":
      if (e.sugestoes.length === 0) return { tipo: "nenhuma" };
      return {
        tipo: "destacar",
        indice: e.destaque <= 0 ? e.sugestoes.length - 1 : e.destaque - 1,
      };
    case "Escape":
      return e.sugestoes.length > 0 ? { tipo: "fechar" } : { tipo: "nenhuma" };
    default:
      return { tipo: "nenhuma" };
  }
}

/** `true` se a tecla deve ter o comportamento padrão bloqueado (Enter nunca envia o formulário). */
export function deveBloquear(e: EstadoTecla, acao: AcaoTecla): boolean {
  if (e.compondo) return false;
  return acao.tipo !== "nenhuma" || e.key === "Enter";
}
