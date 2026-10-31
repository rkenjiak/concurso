import { CalendarCheck, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { ListaPrazos } from "@/components/dashboard/lista-prazos";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JANELA_PADRAO_DIAS } from "@/domain/prazos";
import { ehAtivo } from "@/domain/status";
import { formatarData } from "@/lib/format";
import { hojeSP } from "@/lib/tz";
import { getDb } from "@/server/db/client";
import { obterDashboard } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

function Grupo({
  titulo,
  descricao,
  vazio,
  children,
  quantidade,
}: {
  titulo: string;
  descricao?: string;
  vazio: string;
  quantidade: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2" aria-label={titulo}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium text-sm">
          {titulo} <span className="text-muted-foreground">({quantidade})</span>
        </h3>
        {descricao ? <p className="text-muted-foreground text-xs">{descricao}</p> : null}
      </div>
      {quantidade === 0 ? <p className="text-muted-foreground text-sm">{vazio}</p> : children}
    </section>
  );
}

export default async function DashboardPage() {
  await connection();
  const hoje = hojeSP();
  const { prazos, totalPrazos, porStatus, totalConcursos } = await obterDashboard(getDb(), hoje);
  const ativos = porStatus.filter((s) => ehAtivo(s.status)).reduce((n, s) => n + s.quantidade, 0);

  const novo = (
    <Button asChild>
      <Link href="/concursos/novo">
        <Plus aria-hidden />
        Novo concurso
      </Link>
    </Button>
  );

  if (totalConcursos === 0) {
    return (
      <div className="space-y-6">
        <CabecalhoPagina titulo="Dashboard" descricao="O que vem a seguir nos seus concursos." />
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <CalendarCheck className="mx-auto size-10 text-muted-foreground" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Nenhum concurso cadastrado ainda</p>
              <p className="text-muted-foreground text-sm">
                Cadastre um concurso e adicione as datas importantes (inscrições, boleto, provas)
                para vê-las aqui.
              </p>
            </div>
            {novo}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Dashboard"
        descricao={`O que vem a seguir nos seus concursos · hoje, ${formatarData(hoje)}.`}
        acoes={novo}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Próximos prazos</CardTitle>
            <CardDescription>
              Eventos pendentes de concursos em andamento: vencidos, hoje e próximos{" "}
              {JANELA_PADRAO_DIAS} dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {totalPrazos === 0 ? (
              <div className="space-y-2 py-6 text-center">
                <CalendarCheck className="mx-auto size-8 text-muted-foreground" aria-hidden />
                <p className="font-medium">Nenhum prazo nos próximos {JANELA_PADRAO_DIAS} dias</p>
                <p className="text-muted-foreground text-sm">
                  Adicione eventos na aba “Eventos” de cada concurso para acompanhá-los aqui.
                </p>
              </div>
            ) : (
              <>
                {prazos.vencidos.length > 0 ? (
                  <Grupo
                    titulo="Vencidos"
                    descricao="Prazos críticos não marcados como concluídos"
                    vazio=""
                    quantidade={prazos.vencidos.length}
                  >
                    <ListaPrazos prazos={prazos.vencidos} />
                  </Grupo>
                ) : null}
                <Grupo titulo="Hoje" vazio="Nada para hoje." quantidade={prazos.hoje.length}>
                  <ListaPrazos prazos={prazos.hoje} />
                </Grupo>
                <Grupo
                  titulo={`Próximos ${JANELA_PADRAO_DIAS} dias`}
                  vazio="Nenhum prazo nos próximos dias."
                  quantidade={prazos.proximos.length}
                >
                  <ListaPrazos prazos={prazos.proximos} />
                </Grupo>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Concursos por status</CardTitle>
            <CardDescription>
              {totalConcursos} {totalConcursos === 1 ? "concurso" : "concursos"} · {ativos} em
              andamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2">
              {porStatus.map(({ status, quantidade }) => (
                <li key={status}>
                  <Link
                    href={`/concursos?status=${status}`}
                    className="flex h-full flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="font-semibold text-2xl tabular-nums">{quantidade}</span>
                    <BadgeStatus status={status} className="max-w-full truncate" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
