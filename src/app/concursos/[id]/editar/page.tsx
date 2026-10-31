import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormularioConcurso } from "@/components/concurso/formulario-concurso";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { idSchema } from "@/lib/schemas/comum";
import { valoresDoConcurso } from "@/lib/schemas/concurso";
import { getDb } from "@/server/db/client";
import { obterConcurso } from "@/server/queries/concursos";

export const metadata: Metadata = { title: "Editar concurso" };

export default async function EditarConcursoPage({ params }: PageProps<"/concursos/[id]/editar">) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const concurso = await obterConcurso(getDb(), id.data);
  if (!concurso) notFound();

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Editar concurso"
        descricao={`${concurso.orgao} — ${concurso.cargo}`}
      />
      <FormularioConcurso valoresIniciais={valoresDoConcurso(concurso)} concursoId={concurso.id} />
    </div>
  );
}
