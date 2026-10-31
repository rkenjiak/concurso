import type { Metadata } from "next";
import { FormularioConcurso } from "@/components/concurso/formulario-concurso";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { VALORES_INICIAIS_CONCURSO } from "@/lib/schemas/concurso";

export const metadata: Metadata = { title: "Novo concurso" };

export default function NovoConcursoPage() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Novo concurso" descricao="Campos com * são obrigatórios." />
      <FormularioConcurso valoresIniciais={VALORES_INICIAIS_CONCURSO} />
    </div>
  );
}
