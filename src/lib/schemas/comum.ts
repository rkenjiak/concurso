/**
 * Blocos reutilizáveis dos schemas Zod. Os schemas recebem os valores crus do formulário
 * (strings) e produzem os dados normalizados que vão para o banco; o mesmo schema roda no
 * cliente (react-hook-form) e no servidor (Server Actions).
 */
import { z } from "zod";
import { parseBRL, parseDecimal } from "../format";
import { normalizarTag } from "../normalize";

/** Texto obrigatório (trim) com limite de tamanho. */
export function textoObrigatorio(mensagem: string, max: number) {
  return z
    .string({ error: mensagem })
    .trim()
    .min(1, mensagem)
    .max(max, `Use no máximo ${max} caracteres.`);
}

/** Texto opcional: string vazia vira `null`. */
export function textoOpcional(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));
}

/** Enum opcional vindo de `<select>`: "" vira `null`. */
export function enumOpcional<const T extends readonly [string, ...string[]]>(
  valores: T,
  mensagem = "Opção inválida.",
) {
  return z
    .union([z.literal(""), z.enum(valores, { error: mensagem })], { error: mensagem })
    .transform((v) => (v === "" ? null : v));
}

/** Moeda digitada ("1.234,56") → centavos; vazio → `null`. */
export const moedaOpcional = z.string().transform((v, ctx) => {
  if (v.trim() === "") return null;
  const centavos = parseBRL(v);
  if (centavos === null) {
    ctx.addIssue({ code: "custom", message: "Valor em reais inválido." });
    return z.NEVER;
  }
  return centavos;
});

/** Inteiro não negativo digitado como texto; vazio → `null`. */
export function inteiroOpcional(max = 1_000_000) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      if (!/^\d+$/.test(v) || Number(v) > max) {
        ctx.addIssue({ code: "custom", message: `Informe um número inteiro entre 0 e ${max}.` });
        return z.NEVER;
      }
      return Number(v);
    });
}

/** Número decimal não negativo digitado ("72,5" ou "72.5"), até `max`; vazio → `null`. */
export function decimalOpcional(max = 100_000) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = parseDecimal(v);
      if (n === null || n > max) {
        ctx.addIssue({
          code: "custom",
          message: `Informe um número entre 0 e ${max} (até 3 casas decimais).`,
        });
        return z.NEVER;
      }
      return n;
    });
}

/** ID numérico positivo (parâmetros de rota e de ações). */
export const idSchema = z.coerce.number().int().positive();

export const MAX_TAGS = 20;
export const MAX_TAMANHO_TAG = 40;

/**
 * Tags livres: normalizadas (trim + minúsculas), sem vazias nem repetidas. Os erros ficam no
 * caminho `tags` (não por item), para exibição única no formulário.
 */
export const tagsSchema = z
  .array(z.string(), { error: "Tags inválidas." })
  .transform((tags) => [...new Set(tags.map(normalizarTag).filter((t) => t !== ""))])
  .refine((tags) => tags.length <= MAX_TAGS, `Use no máximo ${MAX_TAGS} tags.`)
  .refine(
    (tags) => tags.every((t) => t.length <= MAX_TAMANHO_TAG),
    `Cada tag pode ter até ${MAX_TAMANHO_TAG} caracteres.`,
  );
