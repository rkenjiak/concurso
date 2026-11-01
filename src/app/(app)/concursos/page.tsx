import { CalendarDays, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AlternarVisao } from "@/components/concurso/alternar-visao";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { FiltrosConcursosForm } from "@/components/concurso/filtros-concursos";
import { ListaTags } from "@/components/concurso/lista-tags";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { QuadroConcursos } from "@/components/concurso/quadro-concursos";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { corDoConcurso } from "@/domain/cores";
import { ROTULO_ESFERA } from "@/domain/labels";
import { formatarBRL, formatarData } from "@/lib/format";
import {
  FILTROS_VAZIOS,
  filtrosParaBusca,
  hrefConcursos,
  lerFiltrosConcursos,
  lerVisao,
  temFiltros,
} from "@/lib/schemas/filtros-concursos";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { listarConcursos } from "@/server/queries/concursos";
import { opcoesStatusPorConcurso } from "@/server/queries/historico";

export const metadata: Metadata = { title: "Concursos" };

export default async function ConcursosPage({ searchParams }: PageProps<"/concursos">) {
  await connection();
  const parametros = await searchParams;
  const filtros = lerFiltrosConcursos(parametros);
  const visao = lerVisao(parametros);
  const busca = filtrosParaBusca(filtros);
  const filtrando = temFiltros(filtros);
  const { id: usuarioId } = await exigirUsuarioPagina();
  const concursos = await listarConcursos(getDb(), usuarioId, filtros, hojeSP());
  const limpar = hrefConcursos({ ...FILTROS_VAZIOS, ordem: filtros.ordem }, visao);
  const opcoes = visao === "quadro" ? await opcoesStatusPorConcurso(getDb(), concursos) : null;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Concursos"
        descricao="Cadastre e acompanhe seus concursos."
        acoes={
          <Button asChild>
            <Link href="/concursos/novo">
              <Plus aria-hidden />
              Novo concurso
            </Link>
          </Button>
        }
      />
      <AlternarVisao filtros={filtros} visao={visao} />
      <FiltrosConcursosForm key={busca} filtros={filtros} visao={visao} />
      {filtrando ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {concursos.length === 1
            ? "1 concurso encontrado."
            : `${concursos.length} concursos encontrados.`}
        </p>
      ) : null}
      {concursos.length === 0 && filtrando ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum concurso encontrado com esses filtros.{" "}
            <Link href={limpar} className="text-primary underline underline-offset-4">
              Limpar filtros
            </Link>
            .
          </CardContent>
        </Card>
      ) : concursos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum concurso cadastrado ainda.{" "}
            <Link href="/concursos/novo" className="text-primary underline underline-offset-4">
              Cadastre o primeiro
            </Link>
            .
          </CardContent>
        </Card>
      ) : opcoes ? (
        <QuadroConcursos
          key={busca}
          cartoes={concursos.map((c) => ({
            id: c.id,
            orgao: c.orgao,
            cargo: c.cargo,
            banca: c.banca,
            status: c.status,
            proximaData: c.proximaData,
            tags: c.tags,
            cor: corDoConcurso(c),
            icone: c.icone,
            transicoes: opcoes.get(c.id)?.transicoes ?? [],
          }))}
        />
      ) : (
        <ul className="grid gap-3">
          {concursos.map((c) => {
            const local = [c.cidade, c.uf].filter(Boolean).join(" / ");
            const detalhes = [
              c.banca,
              c.esfera ? ROTULO_ESFERA[c.esfera] : null,
              local || null,
              c.remuneracaoCentavos != null ? formatarBRL(c.remuneracaoCentavos) : null,
            ].filter(Boolean);
            return (
              <li key={c.id}>
                <Link
                  href={`/concursos/${c.id}`}
                  className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium">
                        <MarcadorConcurso cor={corDoConcurso(c)} icone={c.icone} />
                        <span className="min-w-0 truncate">{c.orgao}</span>
                      </p>
                      <p className="truncate text-muted-foreground text-sm">{c.cargo}</p>
                    </div>
                    <BadgeStatus status={c.status} />
                  </div>
                  {detalhes.length > 0 ? (
                    <p className="mt-2 text-muted-foreground text-xs">{detalhes.join(" · ")}</p>
                  ) : null}
                  {c.proximaData ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-muted-foreground text-xs">
                      <CalendarDays className="size-3.5" aria-hidden />
                      Próxima data: {formatarData(c.proximaData)}
                    </p>
                  ) : null}
                  {c.tags.length > 0 ? (
                    <div className="mt-2">
                      <ListaTags tags={c.tags} />
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
