import type { Metadata } from "next";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Configurações" };

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Configurações" descricao="Backup dos dados e informações do app." />
      <Card>
        <CardHeader>
          <CardTitle>Exportar e importar</CardTitle>
          <CardDescription>Backup completo em JSON/CSV e restauração.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">Em breve.</CardContent>
      </Card>
    </div>
  );
}
