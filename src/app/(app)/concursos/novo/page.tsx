import type { Metadata } from "next";
import { connection } from "next/server";
import { FormularioConcurso } from "@/components/concurso/formulario-concurso";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";
import { getDb } from "@/server/db/client";
import { listarTags } from "@/server/queries/tags";

export const metadata: Metadata = { title: "Novo concurso" };

export default async function NovoConcursoPage() {
  await connection();
  const tags = await listarTags(getDb());
  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Novo concurso" descricao="Campos com * são obrigatórios." />
      <FormularioConcurso valoresIniciais={VALORES_INICIAIS_CONCURSO} tagsExistentes={tags} />
    </div>
  );
}
