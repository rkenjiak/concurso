import { BellOff, SlidersHorizontal } from "lucide-react";
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
  const hoje = hojeSP();
  const notificacoes = await obterNotificacoes(getDb(), usuarioId, hoje);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Notificações"
        descricao={
          <>
            Avisos gerados pelas suas regras para prazos ainda pendentes, agrupados pela proximidade
            do prazo (hoje e amanhã, próximos 7 dias, mais adiante), o mais próximo primeiro. Para
            ver o que fazer agora, use o{" "}
            <Link
              href="/"
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Dashboard
            </Link>
            .
          </>
        }
        acoes={
          <Button asChild variant="outline">
            <Link href="/configuracoes#notificacoes">
              <SlidersHorizontal aria-hidden />
              Configurar avisos
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent>
          {notificacoes.length === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <BellOff className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">Nenhum aviso por enquanto</p>
              <p className="text-muted-foreground text-sm">
                Quando um prazo pendente chegar à antecedência definida nas suas regras (ex.: 7 dias
                antes do fim das inscrições), o aviso aparece aqui.
              </p>
            </div>
          ) : (
            <ListaNotificacoes
              itens={notificacoes.map((n) => ({
                chave: n.chave,
                eventoId: n.evento?.id ?? null,
                mensagem: n.mensagem,
                data: n.data,
                hora: n.hora,
                dias: n.dias,
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
