import { notFound } from "next/navigation";
import { cache } from "react";
import { exigirAdminPagina } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { obterDetalheUsuario } from "@/server/repositories/admin";

/** Só dígitos: rejeita "1e3", " 1", "0x1" etc. antes de converter (#108). */
const ID_VALIDO = /^\d+$/;

/**
 * O usuário do `[id]` da URL para o painel; ID malformado ou inexistente → `notFound()`. Exige o
 * papel antes de consultar. O `cache` deduplica entre o layout (404 antes do `loading.tsx`, #110)
 * e a página na mesma renderização.
 */
export const carregarUsuario = cache(async (idBruto: string) => {
  await exigirAdminPagina();
  const id = ID_VALIDO.test(idBruto) ? Number(idBruto) : Number.NaN;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const usuario = await obterDetalheUsuario(getDb(), id);
  if (!usuario) notFound();
  return usuario;
});
