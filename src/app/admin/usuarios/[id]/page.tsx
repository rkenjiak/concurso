import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AcoesUsuario } from "@/components/admin/acoes-usuario";
import { BotaoRevogarTokens } from "@/components/admin/botao-revogar-tokens";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROTULO_MOTIVO_SEM_ACESSO, ROTULO_ORIGEM_ACESSO, ROTULO_PAPEL } from "@/domain/labels";
import { formatarDataHora, formatarDataInstante } from "@/lib/format";
import { exigirAdminPagina } from "@/server/auth/admin";
import { acessoHoje } from "@/server/auth/autorizacao";
import { lerConfigAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import {
  ehEmailAdminFixo,
  nomeUsuario,
  obterDetalheUsuario,
  rotuloUsuario,
} from "@/server/repositories/admin";

export const metadata: Metadata = { title: "Usuário" };

/** Só dígitos: rejeita "1e3", " 1", "0x1" etc. antes de converter (#108). */
const ID_VALIDO = /^\d+$/;

function Item({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Token({
  rotulo,
  ativo,
  usadoEm,
}: {
  rotulo: string;
  ativo: boolean;
  usadoEm: Date | null;
}) {
  return (
    <Item rotulo={rotulo}>
      {ativo ? (
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Ativo</Badge>
          <span className="text-muted-foreground">
            {usadoEm ? `usado por último em ${formatarDataHora(usadoEm)}` : "ainda não usado"}
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground">Inativo</span>
      )}
    </Item>
  );
}

/**
 * Detalhe de um usuário no painel (#108): origem do acesso, "sem acesso hoje", conta Google
 * vinculada, contagens agregadas e tokens pessoais, com a ação de revogá-los sem bloquear. Só
 * flags, datas técnicas e contagens: o conteúdo dos concursos continua privado.
 */
export default async function UsuarioAdminPage({ params }: PageProps<"/admin/usuarios/[id]">) {
  await connection();
  const admin = await exigirAdminPagina();
  const bruto = (await params).id;
  const id = ID_VALIDO.test(bruto) ? Number(bruto) : Number.NaN;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  // Como em /concursos/[id], o loading.tsx do painel já enviou o HTTP 200: o 404 chega como
  // conteúdo (a página "não encontrada"), não como status.
  const u = await obterDetalheUsuario(getDb(), id);
  if (!u) notFound();
  const config = lerConfigAuth();
  const fixos: ReadonlySet<string> = config.habilitada ? config.emailsAdmin : new Set();
  const acesso = acessoHoje(config, u);
  const rotulo = rotuloUsuario(u);
  const ehVoce = u.id === admin.id;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/admin/usuarios">
          <ArrowLeft aria-hidden />
          Usuários
        </Link>
      </Button>
      <CabecalhoPagina
        titulo={nomeUsuario(u)}
        descricao={u.email ?? "sem e-mail"}
        acoes={
          <AcoesUsuario
            id={u.id}
            rotulo={rotulo}
            ehAdmin={u.papel === "ADMIN"}
            bloqueado={u.bloqueadoEm !== null}
            ehVoce={ehVoce}
            adminFixo={ehEmailAdminFixo(u.email, fixos)}
          />
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Item rotulo="Situação">
                {acesso.temAcesso ? (
                  <Badge variant="secondary">Com acesso hoje</Badge>
                ) : (
                  <span className="space-y-1">
                    <Badge variant="destructive">Sem acesso hoje</Badge>
                    {acesso.motivo ? (
                      <span className="block text-muted-foreground">
                        {ROTULO_MOTIVO_SEM_ACESSO[acesso.motivo]}
                      </span>
                    ) : null}
                  </span>
                )}
              </Item>
              <Item rotulo="Origem do acesso">
                {acesso.origens.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {acesso.origens.map((o) => (
                      <Badge key={o} variant="outline">
                        {ROTULO_ORIGEM_ACESSO[o]}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Nenhuma</span>
                )}
              </Item>
              <Item rotulo="Papel">{ROTULO_PAPEL[u.papel]}</Item>
              <Item rotulo="Conta Google vinculada">{u.googleVinculado ? "Sim" : "Não"}</Item>
              {u.bloqueadoEm ? (
                <Item rotulo="Bloqueado em">{formatarDataHora(u.bloqueadoEm)}</Item>
              ) : null}
              <Item rotulo="Cadastro">{formatarDataInstante(u.createdAt)}</Item>
              <Item rotulo="Último acesso">{formatarDataHora(u.ultimoAcessoEm)}</Item>
            </dl>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3">
                <Item rotulo="Concursos">{u.contagens.concursos}</Item>
                <Item rotulo="Eventos">{u.contagens.eventos}</Item>
                <Item rotulo="Links">{u.contagens.links}</Item>
                <Item rotulo="Resultados">{u.contagens.resultados}</Item>
              </dl>
              <p className="mt-3 text-muted-foreground text-xs">
                Só contagens: o conteúdo dos concursos continua privado.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tokens pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-3">
                <Token rotulo="MCP (HTTP)" ativo={u.mcpTokenAtivo} usadoEm={u.mcpTokenUsadoEm} />
                <Token rotulo="Feed .ics" ativo={u.icsTokenAtivo} usadoEm={u.icsTokenUsadoEm} />
              </dl>
              {u.mcpTokenAtivo || u.icsTokenAtivo ? (
                <BotaoRevogarTokens id={u.id} rotulo={rotulo} />
              ) : null}
              <p className="text-muted-foreground text-xs">
                O MCP local por stdio (<code>pnpm mcp</code>) não usa token e não é contado.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
