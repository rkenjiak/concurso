import { notFound } from "next/navigation";
import { cache } from "react";
import { idSchema } from "@/lib/schemas/comum";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { concursoDoUsuarioExiste, obterConcurso } from "@/server/queries/concursos";

/** ID da URL; malformado → `notFound()`. */
function idDaUrl(bruto: string): number {
  const id = idSchema.safeParse(bruto);
  if (!id.success) notFound();
  return id.data;
}

/**
 * Para o layout (#110): o concurso do `[id]` existe e é do usuário logado, senão `notFound()`, antes
 * do `loading.tsx` (abaixo dele o 404 sairia com status 200). Leitura enxuta: o layout também roda
 * no prefetch dos links para o detalhe.
 */
export const conferirConcurso = cache(async (idBruto: string): Promise<void> => {
  const id = idDaUrl(idBruto);
  const { id: usuarioId } = await exigirUsuarioPagina();
  if (!(await concursoDoUsuarioExiste(getDb(), usuarioId, id))) notFound();
});

/**
 * O concurso do `[id]` da URL, do usuário logado; ID malformado, inexistente ou de outro usuário
 * → `notFound()`. Continua sendo a garantia das páginas: o layout não é reexecutado ao navegar
 * entre o detalhe e a edição. O `cache` deduplica entre o `generateMetadata` e a página.
 */
export const carregarConcurso = cache(async (idBruto: string) => {
  const id = idDaUrl(idBruto);
  const { id: usuarioId } = await exigirUsuarioPagina();
  // Concurso de outro usuário: 404, como se não existisse.
  const concurso = await obterConcurso(getDb(), usuarioId, id);
  if (!concurso) notFound();
  return concurso;
});
