/**
 * Retorno padronizado das Server Actions (ARQUITETURA.md §5.2):
 * `{ ok: true, data } | { ok: false, erros }`. `erros._form` guarda erros gerais (não de campo).
 */
import { z } from "zod";
import { ErroDominio } from "@/domain/erros";

export type ErrosAcao = { _form?: string[] } & Record<string, string[] | undefined>;

export type ResultadoAcao<T = null> = { ok: true; data: T } | { ok: false; erros: ErrosAcao };

export function sucesso<T>(data: T): ResultadoAcao<T> {
  return { ok: true, data };
}

export function falha(mensagem: string): { ok: false; erros: ErrosAcao } {
  return { ok: false, erros: { _form: [mensagem] } };
}

export function falhaValidacao(erro: z.ZodError): { ok: false; erros: ErrosAcao } {
  const { formErrors, fieldErrors } = z.flattenError(erro);
  const erros: ErrosAcao = { ...(fieldErrors as Record<string, string[]>) };
  if (formErrors.length > 0) erros._form = formErrors;
  return { ok: false, erros };
}

/**
 * Executa a mutação convertendo exceções em resultado: erros de domínio viram mensagem para o
 * usuário; erros inesperados são registrados no servidor e viram uma mensagem genérica.
 */
export async function executar<T>(fn: () => Promise<ResultadoAcao<T>>): Promise<ResultadoAcao<T>> {
  try {
    return await fn();
  } catch (erro) {
    if (erro instanceof ErroDominio) return falha(erro.message);
    console.error(erro);
    return falha("Não foi possível concluir a operação. Tente novamente.");
  }
}
