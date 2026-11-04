import { ArrowRight, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AgendaMes, GradeMes, LegendaConcursos } from "@/components/calendario/calendario-mensal";
import { SeletorMes } from "@/components/calendario/seletor-mes";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deslocarMes, lerMes, mesDaData, montarGradeMes } from "@/domain/calendario";
import {
  contarPorMes,
  filtrarPorSelecao,
  hrefCalendario,
  itensDoMes,
  lerSelecaoConcursos,
  normalizarSelecao,
  PARAM_CONCURSOS,
  PARAM_MES,
  proximaProva,
  proximoMesComEventos,
} from "@/domain/navegacao-calendario";
import { formatarMes } from "@/lib/format";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { obterCalendarioCompleto } from "@/server/queries/calendario";

export const metadata: Metadata = { title: "Calendário" };

export default async function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  await connection();
  const hoje = hojeSP();
  const params = await searchParams;
  const mes = lerMes(params[PARAM_MES], hoje);
  const mesHoje = mesDaData(hoje);
  const { id: usuarioId } = await exigirUsuarioPagina();
  const { concursos, itens: todosItens } = await obterCalendarioCompleto(getDb(), usuarioId, hoje);
  const selecao = normalizarSelecao(
    lerSelecaoConcursos(params[PARAM_CONCURSOS]),
    concursos.map((c) => c.id),
  );
  const visiveis = filtrarPorSelecao(todosItens, selecao);
  const doMesSemFiltro = itensDoMes(todosItens, mes);
  const itens = filtrarPorSelecao(doMesSemFiltro, selecao);
  const contagens = contarPorMes(visiveis);
  const proximoComEventos = proximoMesComEventos(contagens, mes);
  const prova = proximaProva(visiveis, hoje);
  const grade = montarGradeMes(mes, hoje);
  const titulo = formatarMes(mes);
  const anterior = deslocarMes(mes, -1);
  const seguinte = deslocarMes(mes, 1);
  const href = (m: string) => hrefCalendario(m, selecao);
  const vazio =
    selecao?.length === 0
      ? "Nenhum concurso selecionado. Use “Mostrar todos” abaixo."
      : doMesSemFiltro.length > itens.length
        ? "Nenhum evento dos concursos selecionados neste mês."
        : undefined;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Calendário"
        descricao="Eventos dos seus concursos mês a mês. Concluídos e de concursos encerrados aparecem esmaecidos."
      />

      <Card>
        <CardContent className="space-y-4">
          <nav aria-label="Navegação entre meses" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg" aria-live="polite">
                <SeletorMes
                  mes={mes}
                  mesHoje={mesHoje}
                  contagens={Object.fromEntries(contagens)}
                  selecao={selecao}
                />
              </h2>
              <div className="flex items-center gap-1">
                <Button asChild variant="outline" size="icon" aria-label="Mês anterior">
                  <Link href={href(anterior)} title={formatarMes(anterior)}>
                    <ChevronLeft aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={href(mesHoje)} aria-current={mes === mesHoje ? "page" : undefined}>
                    Hoje
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" aria-label="Próximo mês">
                  <Link href={href(seguinte)} title={formatarMes(seguinte)}>
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
            {proximoComEventos || prova ? (
              <ul aria-label="Atalhos" className="flex flex-wrap gap-2">
                {proximoComEventos ? (
                  <li>
                    <Button asChild variant="secondary" size="sm">
                      <Link
                        href={href(proximoComEventos)}
                        aria-label={`Próximos eventos: ${formatarMes(proximoComEventos)}`}
                      >
                        Próximos eventos
                        <span className="text-muted-foreground">
                          · {formatarMes(proximoComEventos)}
                        </span>
                        <ArrowRight aria-hidden />
                      </Link>
                    </Button>
                  </li>
                ) : null}
                {prova ? (
                  <li>
                    <Button asChild variant="secondary" size="sm">
                      <Link
                        href={href(mesDaData(prova.item.data))}
                        aria-label={`Próxima prova: ${prova.contagem.rotulo}, ${prova.item.concurso.orgao}`}
                        title={`${prova.contagem.rotulo} · ${prova.item.concurso.orgao}`}
                      >
                        <GraduationCap aria-hidden />
                        Próxima prova
                        <span className="text-muted-foreground">· {prova.contagem.texto}</span>
                      </Link>
                    </Button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </nav>

          <div className="hidden space-y-2 md:block">
            {vazio && itens.length === 0 ? (
              <p className="text-muted-foreground text-sm">{vazio}</p>
            ) : null}
            <GradeMes grade={grade} itens={itens} titulo={titulo} hoje={hoje} />
          </div>
          <div className="md:hidden">
            <AgendaMes itens={itens} hoje={hoje} vazio={vazio} />
          </div>

          <LegendaConcursos
            mes={mes}
            itens={doMesSemFiltro}
            concursos={concursos}
            selecao={selecao}
          />

          <ul
            aria-label="Legenda"
            className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs"
          >
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-l-4 border-l-destructive bg-destructive/10" />
              Prazo crítico em até 3 dias ou vencido
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-l-4 border-l-aviso bg-aviso/15" />
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
