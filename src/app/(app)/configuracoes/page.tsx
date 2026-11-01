import type { Metadata } from "next";
import { connection } from "next/server";
import { BotaoSair } from "@/components/auth/botao-sair";
import { ExportarImportar } from "@/components/configuracoes/exportar-importar";
import { TokenMcp } from "@/components/configuracoes/token-mcp";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { SeletorTema } from "@/components/tema/seletor-tema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { lerConfigAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { obterUsuario } from "@/server/repositories/usuarios";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await connection();
  const config = lerConfigAuth();
  const authHabilitada = config.habilitada;
  const usuario = await exigirUsuarioPagina();
  const temTokenMcp = (await obterUsuario(getDb(), usuario.id))?.mcpTokenHash != null;
  const conta = usuario.email
    ? `${usuario.nome ? `${usuario.nome} — ` : ""}${usuario.email}`
    : "Usuário local";
  const metodos = authHabilitada
    ? [config.google ? "conta Google" : null, config.senha !== null ? "senha (APP_PASSWORD)" : null]
        .filter(Boolean)
        .join(" ou ")
    : null;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="Aparência, backup dos dados, integração com LLM e acesso."
      />
      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>
            Tema claro, escuro ou do sistema (padrão). A escolha fica salva neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeletorTema />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Exportar e importar</CardTitle>
          <CardDescription>
            Backup dos seus concursos em JSON/CSV e restauração (só os seus dados).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportarImportar />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Token do MCP</CardTitle>
          <CardDescription>
            Para cadastrar concursos a partir do edital com uma LLM pelo endpoint{" "}
            <code>/api/mcp</code>. Envie o token no cabeçalho{" "}
            <code>Authorization: Bearer &lt;token&gt;</code>; ele dá acesso apenas aos seus dados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TokenMcp temToken={temTokenMcp} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Acesso</CardTitle>
          <CardDescription>
            {authHabilitada
              ? `Conectado como ${conta}, por ${metodos}. A sessão dura 30 dias neste navegador.`
              : "Login desligado (uso local): configure o login Google ou APP_PASSWORD e AUTH_SECRET para exigir login."}
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
