import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Dashboard" descricao="O que vem a seguir nos seus concursos." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximos prazos</CardTitle>
            <CardDescription>Vencidos, hoje e próximos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Em breve.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Concursos por status</CardTitle>
            <CardDescription>Contagem por etapa do pipeline.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Em breve.</CardContent>
        </Card>
      </div>
    </div>
  );
}
