import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { BotaoExcluirConcurso } from "@/components/concurso/botao-excluir-concurso";
import { ListaTags } from "@/components/concurso/lista-tags";
import { Markdown } from "@/components/concurso/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROTULO_ESCOLARIDADE, ROTULO_ESFERA } from "@/domain/labels";
import { formatarBRL, formatarDataInstante } from "@/lib/format";
import { idSchema } from "@/lib/schemas/comum";
import { getDb } from "@/server/db/client";
import { obterConcurso } from "@/server/queries/concursos";

async function carregar(params: Promise<{ id: string }>) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const concurso = await obterConcurso(getDb(), id.data);
  if (!concurso) notFound();
  return concurso;
}

export async function generateMetadata({
  params,
}: PageProps<"/concursos/[id]">): Promise<Metadata> {
  const c = await carregar(params);
  return { title: c.orgao };
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const numero = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"));

export default async function ConcursoPage({ params }: PageProps<"/concursos/[id]">) {
  const c = await carregar(params);
  const local = [c.cidade, c.uf].filter(Boolean).join(" / ");

  return (
    <div className="space-y-6">
      <Link
        href="/concursos"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Concursos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">{c.orgao}</h1>
          <p className="text-muted-foreground">{c.cargo}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <BadgeStatus status={c.status} />
            <span className="text-muted-foreground text-xs">
              desde {formatarDataInstante(c.statusDesde)}
            </span>
          </div>
          <div className="pt-1">
            <ListaTags tags={c.tags} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/concursos/${c.id}/editar`}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </Button>
          <BotaoExcluirConcurso id={c.id} nome={`${c.orgao} — ${c.cargo}`} />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Visão geral</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Item rotulo="Banca">{c.banca ?? "—"}</Item>
            <Item rotulo="Esfera">{c.esfera ? ROTULO_ESFERA[c.esfera] : "—"}</Item>
            <Item rotulo="Local">{local || "—"}</Item>
            <Item rotulo="Escolaridade">
              {c.escolaridade ? ROTULO_ESCOLARIDADE[c.escolaridade] : "—"}
            </Item>
            <Item rotulo="Remuneração inicial">{formatarBRL(c.remuneracaoCentavos)}</Item>
            <Item rotulo="Taxa de inscrição">{formatarBRL(c.taxaInscricaoCentavos)}</Item>
            <Item rotulo="Vagas (ampla)">{numero(c.vagasAmpla)}</Item>
            <Item rotulo="Vagas (cotas)">{numero(c.vagasCotas)}</Item>
            <Item rotulo="Cadastro de reserva">
              {c.possuiCadastroReserva
                ? c.vagasCadastroReserva != null
                  ? `Sim (${numero(c.vagasCadastroReserva)})`
                  : "Sim"
                : c.vagasCadastroReserva != null
                  ? numero(c.vagasCadastroReserva)
                  : "Não"}
            </Item>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent>
          {c.observacoes ? (
            <Markdown>{c.observacoes}</Markdown>
          ) : (
            <p className="text-muted-foreground text-sm">Sem observações.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
