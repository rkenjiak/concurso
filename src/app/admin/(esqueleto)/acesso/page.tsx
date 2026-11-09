import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { FormularioEmailPermitido } from "@/components/admin/formulario-email-permitido";
import { BotaoConfirmar } from "@/components/concurso/botao-confirmar";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataInstante } from "@/lib/format";
import { removerEmailPermitidoAcao } from "@/server/actions/admin";
import { exigirAdminPagina } from "@/server/auth/admin";
import { lerConfigAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { listarEmailsPermitidos } from "@/server/repositories/admin";

export const metadata: Metadata = { title: "Acesso" };

interface LinhaAcesso {
  email: string;
  origem: "ADMIN_EMAILS" | "ALLOWED_EMAILS" | "Painel";
  detalhe: string | null;
  removivel: boolean;
}

export default async function AcessoAdminPage() {
  await connection();
  await exigirAdminPagina();
  const config = lerConfigAuth();
  const googleAtivo = config.habilitada && config.google !== null;
  const doPainel = await listarEmailsPermitidos(getDb());

  const linhas: LinhaAcesso[] = [
    ...[...(config.habilitada ? config.emailsAdmin : [])].map((email) => ({
      email,
      origem: "ADMIN_EMAILS" as const,
      detalhe: "admin garantido",
      removivel: false,
    })),
    ...[...(config.habilitada ? config.emailsPermitidos : [])].map((email) => ({
      email,
      origem: "ALLOWED_EMAILS" as const,
      detalhe: null,
      removivel: false,
    })),
    ...doPainel.map((e) => ({
      email: e.email,
      origem: "Painel" as const,
      detalhe: `liberado em ${formatarDataInstante(e.createdAt)}${e.adicionadoPor ? ` por ${e.adicionadoPor}` : ""}`,
      removivel: true,
    })),
  ].sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Acesso"
        descricao="Quem pode entrar com Google: e-mails das variáveis de ambiente e os liberados aqui."
      />
      {googleAtivo ? null : (
        <p role="status" className="rounded-lg border px-4 py-3 text-muted-foreground text-sm">
          O login Google não está configurado: esta lista só passa a valer quando ele for ativado
          (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e ADMIN_EMAILS).
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Liberar um e-mail</CardTitle>
          <CardDescription>
            A pessoa entra com a conta Google desse e-mail e começa com os próprios dados, vazios.
            Admins sempre têm acesso; para tirar o acesso de um admin, rebaixe-o ou bloqueie-o em
            Usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioEmailPermitido />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>E-mails autorizados ({linhas.length})</CardTitle>
          <CardDescription>
            Os das variáveis de ambiente só mudam na configuração do servidor. Retirar um e-mail
            encerra o acesso na próxima requisição de quem dependia dele.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linhas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum e-mail autorizado.</p>
          ) : (
            <ul className="divide-y">
              {linhas.map((l) => (
                <li
                  key={`${l.origem}-${l.email}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
                >
                  <span className="font-medium">{l.email}</span>
                  <Badge variant={l.origem === "Painel" ? "secondary" : "outline"}>
                    {l.origem}
                  </Badge>
                  {l.detalhe ? (
                    <span className="text-muted-foreground text-xs">{l.detalhe}</span>
                  ) : null}
                  {l.removivel ? (
                    <span className="ml-auto">
                      <BotaoConfirmar
                        tamanho="sm"
                        variante="ghost"
                        destrutivo
                        titulo="Retirar acesso?"
                        descricao={`${l.email} deixa de poder entrar (a conta e os dados são mantidos; admins continuam com acesso).`}
                        rotuloConfirmar="Retirar"
                        rotuloAcessivel={`Retirar ${l.email}`}
                        acao={removerEmailPermitidoAcao.bind(null, l.email)}
                      >
                        <Trash2 aria-hidden />
                        Retirar
                      </BotaoConfirmar>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
