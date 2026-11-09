import type { Metadata } from "next";
import { FormularioConcurso } from "@/components/concurso/formulario-concurso";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { valoresDoConcurso } from "@/lib/schemas/concurso";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { listarTags } from "@/server/queries/tags";
import { carregarConcurso } from "../carregar";

export const metadata: Metadata = { title: "Editar concurso" };

export default async function EditarConcursoPage({ params }: PageProps<"/concursos/[id]/editar">) {
  const [concurso, tags] = await Promise.all([
    carregarConcurso((await params).id),
    exigirUsuarioPagina().then((u) => listarTags(getDb(), u.id)),
  ]);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Editar concurso"
        descricao={`${concurso.orgao} — ${concurso.cargo}`}
      />
      <FormularioConcurso
        valoresIniciais={valoresDoConcurso(concurso)}
        concursoId={concurso.id}
        tagsExistentes={tags}
      />
    </div>
  );
}
