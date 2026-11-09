import { notFound } from "next/navigation";
import { cache } from "react";
import { idSchema } from "@/lib/schemas/comum";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { obterConcurso } from "@/server/queries/concursos";

/**
 * O concurso do `[id]` da URL, do usuário logado; ID malformado, inexistente ou de outro usuário
 * → `notFound()`. O `cache` deduplica a consulta entre o layout (que garante o 404 antes do
 * `loading.tsx`, #110), o `generateMetadata` e a página na mesma renderização.
 */
export const carregarConcurso = cache(async (idBruto: string) => {
  const id = idSchema.safeParse(idBruto);
  if (!id.success) notFound();
  const { id: usuarioId } = await exigirUsuarioPagina();
  // Concurso de outro usuário: 404, como se não existisse.
  const concurso = await obterConcurso(getDb(), usuarioId, id.data);
  if (!concurso) notFound();
  return concurso;
});
