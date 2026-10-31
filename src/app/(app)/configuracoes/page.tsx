import type { Metadata } from "next";
import { connection } from "next/server";
import { BotaoSair } from "@/components/auth/botao-sair";
import { ExportarImportar } from "@/components/configuracoes/exportar-importar";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lerConfigAuth } from "@/server/auth/config";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await connection();
  const authHabilitada = lerConfigAuth().habilitada;

  return (
    <div className="space-y-6">
      <CabecalhoPagina titulo="Configurações" descricao="Backup dos dados e informações do app." />
      <Card>
        <CardHeader>
          <CardTitle>Exportar e importar</CardTitle>
          <CardDescription>Backup completo em JSON/CSV e restauração.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportarImportar />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Acesso</CardTitle>
          <CardDescription>
            {authHabilitada
              ? "Login por senha ativo (APP_PASSWORD). A sessão dura 30 dias neste navegador."
              : "Login desligado: defina APP_PASSWORD e AUTH_SECRET para exigir senha."}
          </CardDescription>
        </CardHeader>
        {authHabilitada ? (
          <CardContent>
            <BotaoSair />
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
