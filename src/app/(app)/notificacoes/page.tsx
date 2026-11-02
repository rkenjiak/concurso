import { BellOff, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { ListaNotificacoes } from "@/components/notificacoes/lista-notificacoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { obterNotificacoes } from "@/server/queries/notificacoes";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificacoesPage() {
  await connection();
  const { id: usuarioId } = await exigirUsuarioPagina();
  const notificacoes = await obterNotificacoes(getDb(), usuarioId, hojeSP());

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Notificações"
        descricao="Avisos dos prazos próximos, conforme as regras de notificação."
        acoes={
          <Button asChild variant="outline">
            <Link href="/configuracoes#notificacoes">
              <Settings aria-hidden />
              Regras
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent>
          {notificacoes.length === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <BellOff className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">Nenhuma notificação</p>
              <p className="text-muted-foreground text-sm">
                Os avisos aparecem aqui conforme os prazos se aproximam (ex.: 7 dias antes do fim
                das inscrições).
              </p>
            </div>
          ) : (
            <ListaNotificacoes
              itens={notificacoes.map((n) => ({
                chave: n.chave,
                mensagem: n.mensagem,
                data: n.data,
                hora: n.hora,
                lida: n.lida,
                concurso: {
                  id: n.concurso.id,
                  orgao: n.concurso.orgao,
                  cargo: n.concurso.cargo,
                  cor: n.concurso.cor,
                  icone: n.concurso.icone,
                },
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
