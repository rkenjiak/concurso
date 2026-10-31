import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Concursos" };

export default function ConcursosPage() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Concursos" descricao="Cadastre e acompanhe seus concursos." />
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhum concurso cadastrado ainda. O cadastro chega na próxima versão.
        </CardContent>
      </Card>
    </div>
  );
}
