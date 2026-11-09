import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { BotaoSair } from "@/components/auth/botao-sair";
import { CalendarioIcs } from "@/components/configuracoes/calendario-ics";
import { ExportarImportar } from "@/components/configuracoes/exportar-importar";
import { RegrasNotificacao } from "@/components/configuracoes/regras-notificacao";
import { TokenMcp } from "@/components/configuracoes/token-mcp";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { lerConfigAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { obterRegras } from "@/server/queries/notificacoes";
import { obterUsuario } from "@/server/repositories/usuarios";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Alvos das âncoras: no celular o cabeçalho é fixo (3.5rem + área segura, ver `casca.tsx`), então
 * o card para logo abaixo dele; no desktop não há cabeçalho fixo (#106).
 */
const ALVO_ANCORA = "scroll-mt-[calc(4.5rem+env(safe-area-inset-top))] md:scroll-mt-6";

/**
 * Índice da página, na ordem das seções. `#notificacoes` e `#calendario` são linkados por outras
 * telas (ex.: Notificações): não mudar (#106).
 */
const INDICE = [
  { id: "notificacoes", rotulo: "Notificações" },
  { id: "calendario", rotulo: "Calendário (.ics)" },
  { id: "exportar", rotulo: "Exportar e importar" },
  { id: "mcp", rotulo: "Token do MCP" },
  { id: "acesso", rotulo: "Acesso" },
] as const;

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-semibold text-lg tracking-tight">
        {titulo}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default async function ConfiguracoesPage() {
  await connection();
  const config = lerConfigAuth();
  const authHabilitada = config.habilitada;
  const usuario = await exigirUsuarioPagina();
  const db = getDb();
  const [dados, regras] = await Promise.all([
    obterUsuario(db, usuario.id),
    obterRegras(db, usuario.id),
  ]);
  const temTokenMcp = dados?.mcpTokenHash != null;
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
        descricao="Avisos e calendário, backup dos dados, integração com LLM e acesso à conta."
      />
      {/* Rótulo visual em `<p>` (não heading) para os h2 serem só as seções. */}
      <nav aria-label="Nesta página" className="space-y-2">
        <p aria-hidden className="font-medium text-muted-foreground text-sm">
          Nesta página
        </p>
        <ul className="flex flex-wrap gap-2">
          {INDICE.map(({ id, rotulo }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 pointer-coarse:h-11 pointer-coarse:px-4"
              >
                {rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Secao id="secao-avisos" titulo="Avisos">
        <Card id="notificacoes" className={ALVO_ANCORA}>
          <CardHeader>
            <CardTitle asChild>
              <h3>Notificações</h3>
            </CardTitle>
            <CardDescription>
              Quais prazos avisam no app (Notificações) e com quantos dias de antecedência. Para
              silenciar um concurso, use o botão no detalhe dele.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegrasNotificacao regras={Object.values(regras)} />
          </CardContent>
        </Card>
        <Card id="calendario" className={ALVO_ANCORA}>
          <CardHeader>
            <CardTitle asChild>
              <h3>Calendário (.ics)</h3>
            </CardTitle>
            <CardDescription>
              Assine seus prazos no app de calendário do celular ou baixe um arquivo .ics. A
              assinatura atualiza sozinha quando você muda um evento aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarioIcs
              temToken={dados?.icsTokenHash != null}
              incluirConcluidos={dados?.icsIncluirConcluidos ?? true}
              incluirEncerrados={dados?.icsIncluirEncerrados ?? false}
            />
          </CardContent>
        </Card>
      </Secao>
      <Secao id="secao-dados" titulo="Dados">
        <Card id="exportar" className={ALVO_ANCORA}>
          <CardHeader>
            <CardTitle asChild>
              <h3>Exportar e importar</h3>
            </CardTitle>
            <CardDescription>
              Backup dos seus concursos em JSON/CSV e restauração (só os seus dados).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportarImportar />
          </CardContent>
        </Card>
      </Secao>
      <Secao id="secao-integracoes" titulo="Integrações">
        <Card id="mcp" className={ALVO_ANCORA}>
          <CardHeader>
            <CardTitle asChild>
              <h3>Token do MCP</h3>
            </CardTitle>
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
      </Secao>
      <Secao id="secao-conta" titulo="Conta">
        <Card id="acesso" className={ALVO_ANCORA}>
          <CardHeader>
            <CardTitle asChild>
              <h3>Acesso</h3>
            </CardTitle>
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
      </Secao>
    </div>
  );
}
