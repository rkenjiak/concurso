import { notFound } from "next/navigation";
import { cache } from "react";
import { exigirAdminPagina } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { obterDetalheUsuario, usuarioExiste } from "@/server/repositories/admin";

/** Só dígitos: rejeita "1e3", " 1", "0x1" etc. antes de converter (#108). */
const ID_VALIDO = /^\d+$/;

/** Exige o papel e lê o ID da URL; malformado → `notFound()`. */
async function idDaUrl(bruto: string): Promise<number> {
  await exigirAdminPagina();
  const id = ID_VALIDO.test(bruto) ? Number(bruto) : Number.NaN;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return id;
}

/**
 * Para o layout (#110): o usuário do `[id]` existe, senão `notFound()`, antes do `loading.tsx`.
 * Leitura enxuta: o layout também roda no prefetch dos links da tabela de usuários.
 */
export const conferirUsuario = cache(async (idBruto: string): Promise<void> => {
  if (!(await usuarioExiste(getDb(), await idDaUrl(idBruto)))) notFound();
});

/** O detalhe do usuário do `[id]` para a página; ID malformado ou inexistente → `notFound()`. */
export const carregarUsuario = cache(async (idBruto: string) => {
  const usuario = await obterDetalheUsuario(getDb(), await idDaUrl(idBruto));
  if (!usuario) notFound();
  return usuario;
});
