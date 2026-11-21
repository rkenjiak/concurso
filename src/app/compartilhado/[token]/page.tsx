import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CronogramaPublico } from "@/components/compartilhado/cronograma-publico";
import { TimelineStatusPublica } from "@/components/compartilhado/timeline-status-publica";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROTULO_ESFERA, ROTULO_STATUS } from "@/domain/labels";
import { formatarDataInstante, formatarDiaMesHora } from "@/lib/format";
import { lerConfigAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { obterConcursoCompartilhado } from "@/server/queries/compartilhamento";

// ISR sob demanda (#129): sem cookies/headers/connection/escritas no GET; revalida a cada 5 min
// e é invalidado na hora em revogação, regeneração, exclusão ou bloqueio/remoção no admin.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

const carregarCompartilhado = cache(async (token: string) =>
  obterConcursoCompartilhado(getDb(), lerConfigAuth(), token),
);

export async function generateMetadata({
  params,
}: PageProps<"/compartilhado/[token]">): Promise<Metadata> {
  const dados = await carregarCompartilhado((await params).token);
  if (!dados) return { robots: { index: false, follow: false } };
  const titulo = `${dados.orgao} — ${dados.cargo}`;
  const local = [dados.cidade, dados.uf].filter(Boolean).join(" / ");
  const descricao =
    [
      ROTULO_STATUS[dados.status],
      dados.banca,
      dados.esfera ? ROTULO_ESFERA[dados.esfera] : null,
      local || null,
    ]
      .filter(Boolean)
      .join(" · ") || "Cronograma e linha do tempo compartilhados";
  return {
    title: titulo,
    description: descricao,
    robots: { index: false, follow: false },
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      locale: "pt_BR",
    },
  };
}

function MetaItem({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm">{valor}</dd>
    </div>
  );
}

export default async function CompartilhadoPage({ params }: PageProps<"/compartilhado/[token]">) {
  const dados = await carregarCompartilhado((await params).token);
  if (!dados) notFound();

  const geradoEm = new Date();
  const local = [dados.cidade, dados.uf].filter(Boolean).join(" / ");
  const temMetadados = Boolean(dados.banca || dados.esfera || local);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
          <span>Cronograma compartilhado (somente leitura)</span>
          <span>
            Dados de <time dateTime={geradoEm.toISOString()}>{formatarDiaMesHora(geradoEm)}</time>
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="flex items-start gap-2 font-semibold text-2xl tracking-tight">
            <MarcadorConcurso cor={dados.cor} icone={dados.icone} className="mt-1.5" />
            <span className="min-w-0 break-words">{dados.orgao}</span>
          </h1>
          <p className="break-words text-muted-foreground">{dados.cargo}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <BadgeStatus status={dados.status} />
          <span className="text-muted-foreground text-xs">
            desde {formatarDataInstante(dados.statusDesde)}
          </span>
        </div>

        {temMetadados ? (
          <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-card/50 p-3 sm:grid-cols-3">
            {dados.banca ? <MetaItem rotulo="Banca" valor={dados.banca} /> : null}
            {dados.esfera ? <MetaItem rotulo="Esfera" valor={ROTULO_ESFERA[dados.esfera]} /> : null}
            {local ? <MetaItem rotulo="Local" valor={local} /> : null}
          </dl>
        ) : null}
      </header>

      <CronogramaPublico status={dados.status} validade={dados.validade} eventos={dados.eventos} />

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>Histórico de status</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineStatusPublica historico={dados.historico} />
        </CardContent>
      </Card>

      <footer className="pt-2 text-center text-muted-foreground text-xs">
        Página pública somente leitura. As datas relativas são calculadas no navegador a partir do
        horário de Brasília.
      </footer>
    </main>
  );
}
