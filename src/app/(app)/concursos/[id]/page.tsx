import { ArrowLeft, CalendarArrowDown, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlterarStatus } from "@/components/concurso/alterar-status";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { BotaoExcluirConcurso } from "@/components/concurso/botao-excluir-concurso";
import { BotaoSilenciarConcurso } from "@/components/concurso/botao-silenciar-concurso";
import { EventosConcurso } from "@/components/concurso/eventos-concurso";
import { LinksConcurso } from "@/components/concurso/links-concurso";
import { ListaTags } from "@/components/concurso/lista-tags";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { Markdown } from "@/components/concurso/markdown";
import { ResultadosConcurso } from "@/components/concurso/resultados-concurso";
import { SugestaoStatus } from "@/components/concurso/sugestao-status";
import { TimelineStatus } from "@/components/concurso/timeline-status";
import { ValidadeConcurso } from "@/components/concurso/validade-concurso";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { corDoConcurso } from "@/domain/cores";
import { ROTULO_ESCOLARIDADE, ROTULO_ESFERA } from "@/domain/labels";
import { sugerirStatus } from "@/domain/sugestao-status";
import { formatarBRL, formatarDataInstante } from "@/lib/format";
import { idSchema } from "@/lib/schemas/comum";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { obterConcurso } from "@/server/queries/concursos";
import { listarEventos } from "@/server/queries/eventos";
import { obterOpcoesStatus } from "@/server/queries/historico";
import { listarLinks } from "@/server/queries/links";
import { listarResultadosFase } from "@/server/queries/resultados";

async function carregar(params: Promise<{ id: string }>) {
  const id = idSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const { id: usuarioId } = await exigirUsuarioPagina();
  // Concurso de outro usuário: 404, como se não existisse.
  const concurso = await obterConcurso(getDb(), usuarioId, id.data);
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
  const [{ historico, opcoes }, links, eventos, resultados] = await Promise.all([
    obterOpcoesStatus(getDb(), c.id, c.status),
    listarLinks(getDb(), c.id),
    listarEventos(getDb(), c.id),
    listarResultadosFase(getDb(), c.id),
  ]);
  const pendentes = eventos.filter((e) => !e.concluido).length;
  const sugestao = sugerirStatus(c.status, eventos, hojeSP());
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
          <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
            <MarcadorConcurso cor={corDoConcurso(c)} icone={c.icone} />
            <span className="min-w-0">{c.orgao}</span>
          </h1>
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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href={`/api/export?formato=ics&concurso=${c.id}`}
              download
              title="Baixar os eventos deste concurso para o calendário"
            >
              <CalendarArrowDown aria-hidden />
              .ics
            </a>
          </Button>
          <BotaoSilenciarConcurso concursoId={c.id} silenciado={c.notificacoesSilenciadas} />
          <Button asChild variant="outline">
            <Link href={`/concursos/${c.id}/editar`}>
              <Pencil aria-hidden />
              Editar
            </Link>
          </Button>
          <BotaoExcluirConcurso id={c.id} nome={`${c.orgao} — ${c.cargo}`} />
        </div>
      </header>

      {sugestao ? (
        <SugestaoStatus concursoId={c.id} para={sugestao.para} motivo={sugestao.motivo} />
      ) : null}

      <Tabs defaultValue="geral" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="eventos">Eventos ({pendentes})</TabsTrigger>
          <TabsTrigger value="links">Links ({links.length})</TabsTrigger>
          <TabsTrigger value="resultados">Resultados ({resultados.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
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
              <CardTitle>Validade do concurso</CardTitle>
            </CardHeader>
            <CardContent>
              <ValidadeConcurso dados={c} hoje={hojeSP()} />
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
        </TabsContent>

        <TabsContent value="eventos">
          <Card>
            <CardHeader>
              <CardTitle>Datas e eventos</CardTitle>
            </CardHeader>
            <CardContent>
              <EventosConcurso
                concursoId={c.id}
                eventos={eventos.map(
                  ({ id, tipo, titulo, data, hora, local, observacao, concluido }) => ({
                    id,
                    tipo,
                    titulo,
                    data,
                    hora,
                    local,
                    observacao,
                    concluido,
                  }),
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle>Links e documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <LinksConcurso
                concursoId={c.id}
                links={links.map(({ id, tipo, rotulo, url }) => ({ id, tipo, rotulo, url }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultados">
          <Card>
            <CardHeader>
              <CardTitle>Resultados por fase</CardTitle>
            </CardHeader>
            <CardContent>
              <ResultadosConcurso
                concursoId={c.id}
                resultados={resultados.map(
                  ({
                    id,
                    fase,
                    descricao,
                    nota,
                    notaMaxima,
                    notaCorte,
                    classificacaoGeral,
                    classificacaoCotas,
                    listaCotas,
                    situacao,
                    observacao,
                  }) => ({
                    id,
                    fase,
                    descricao,
                    nota,
                    notaMaxima,
                    notaCorte,
                    classificacaoGeral,
                    classificacaoCotas,
                    listaCotas,
                    situacao,
                    observacao,
                  }),
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <AlterarStatus
                concursoId={c.id}
                atual={c.status}
                transicoes={opcoes.transicoes}
                desfazerPara={opcoes.desfazerPara}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Histórico de status</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineStatus historico={historico} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
