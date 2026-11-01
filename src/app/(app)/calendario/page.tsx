import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AgendaMes, GradeMes } from "@/components/calendario/calendario-mensal";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deslocarMes, lerMes, mesDaData, montarGradeMes } from "@/domain/calendario";
import { formatarMes } from "@/lib/format";
import { hojeSP } from "@/lib/tz";
import { getDb } from "@/server/db/client";
import { obterCalendario } from "@/server/queries/calendario";

export const metadata: Metadata = { title: "Calendário" };

const hrefMes = (mes: string) => `/calendario?mes=${mes}`;

export default async function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  await connection();
  const hoje = hojeSP();
  const mes = lerMes((await searchParams).mes, hoje);
  const itens = await obterCalendario(getDb(), mes, hoje);
  const grade = montarGradeMes(mes, hoje);
  const titulo = formatarMes(mes);
  const anterior = deslocarMes(mes, -1);
  const seguinte = deslocarMes(mes, 1);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Calendário"
        descricao="Eventos dos seus concursos mês a mês. Concluídos e de concursos encerrados aparecem esmaecidos."
      />

      <Card>
        <CardContent className="space-y-4">
          <nav
            aria-label="Navegação entre meses"
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <h2 className="font-semibold text-lg first-letter:uppercase" aria-live="polite">
              {titulo}
            </h2>
            <div className="flex items-center gap-1">
              <Button asChild variant="outline" size="icon" aria-label="Mês anterior">
                <Link href={hrefMes(anterior)} title={formatarMes(anterior)}>
                  <ChevronLeft aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={hrefMes(mesDaData(hoje))}
                  aria-current={mes === mesDaData(hoje) ? "page" : undefined}
                >
                  Hoje
                </Link>
              </Button>
              <Button asChild variant="outline" size="icon" aria-label="Próximo mês">
                <Link href={hrefMes(seguinte)} title={formatarMes(seguinte)}>
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
          </nav>

          <div className="hidden md:block">
            <GradeMes grade={grade} itens={itens} titulo={titulo} />
          </div>
          <div className="md:hidden">
            <AgendaMes itens={itens} hoje={hoje} />
          </div>

          <ul
            aria-label="Legenda"
            className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs"
          >
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-l-4 border-l-destructive bg-destructive/10" />
              Prazo crítico em até 3 dias ou vencido
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-l-4 border-l-amber-500 bg-amber-500/15" />
              Prazo crítico em até 7 dias
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-muted opacity-60" />
              Concluído ou de concurso encerrado
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
