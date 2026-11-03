import { CalendarCheck, Eye, EyeOff, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { SugestaoStatus } from "@/components/concurso/sugestao-status";
import { ListaPrazos } from "@/components/dashboard/lista-prazos";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JANELA_PADRAO_DIAS, semOcultos, totalPrazos } from "@/domain/prazos";
import { ehAtivo } from "@/domain/status";
import { formatarData } from "@/lib/format";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { visaoAtual } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { obterDashboard } from "@/server/queries/dashboard";
import { listarSugestoesStatus } from "@/server/queries/sugestoes";

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

/** `?ocultos=1` exibe também os prazos ocultos pelo usuário (#44). */
const PARAM_OCULTOS = "ocultos";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  await connection();
  const hoje = hojeSP();
  const mostrarOcultos = (await searchParams)[PARAM_OCULTOS] === "1";
  const usuario = await exigirUsuarioPagina();
  // Admin na visão admin (#50): o início é o painel.
  if ((await visaoAtual(usuario)) === "admin") redirect("/admin");
  const usuarioId = usuario.id;
  const db = getDb();
  // O contador de não lidas fica só no sino global, calculado no layout (#78).
  const [dashboard, sugestoes] = await Promise.all([
    obterDashboard(db, usuarioId, hoje),
    listarSugestoesStatus(db, usuarioId, hoje),
  ]);
  const { porStatus, totalConcursos, ocultos } = dashboard;
  const prazos = mostrarOcultos ? dashboard.prazos : semOcultos(dashboard.prazos);
  const totalExibidos = totalPrazos(prazos);
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
            {/* Sem sino próprio (#78): o global (cabeçalho/barra lateral) é o único ponto de entrada. */}
            <CardTitle>Próximos prazos</CardTitle>
            <CardDescription>
              Eventos pendentes de concursos em andamento: vencidos, hoje e próximos{" "}
              {JANELA_PADRAO_DIAS} dias.
            </CardDescription>
            {ocultos > 0 ? (
              <CardAction className="flex flex-col items-end gap-1">
                <span className="text-muted-foreground text-xs" data-testid="contador-ocultos">
                  {ocultos} {ocultos === 1 ? "oculto" : "ocultos"}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={mostrarOcultos ? "/" : `/?${PARAM_OCULTOS}=1`}
                    aria-pressed={mostrarOcultos}
                  >
                    {mostrarOcultos ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    {mostrarOcultos ? "Esconder ocultos" : "Mostrar ocultos"}
                  </Link>
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {totalExibidos === 0 ? (
              <div className="space-y-2 py-6 text-center">
                <CalendarCheck className="mx-auto size-8 text-muted-foreground" aria-hidden />
                {ocultos > 0 ? (
                  <>
                    <p className="font-medium">Todos os prazos estão ocultos</p>
                    <p className="text-muted-foreground text-sm">
                      Use “Mostrar ocultos” para vê-los e reexibir os que voltarem a interessar.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">
                      Nenhum prazo nos próximos {JANELA_PADRAO_DIAS} dias
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Adicione eventos na aba “Eventos” de cada concurso para acompanhá-los aqui.
                    </p>
                  </>
                )}
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

        {/* min-w-0: item de grid não encolhe abaixo do conteúdo (nome do concurso truncado). */}
        <div className="flex min-w-0 flex-col gap-6">
          {sugestoes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Atualizar status?</CardTitle>
                <CardDescription>
                  Eventos que já passaram sugerem um novo status. Nada muda sem você aplicar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sugestoes.map((c) => (
                  <SugestaoStatus
                    key={c.id}
                    concursoId={c.id}
                    para={c.sugestao.para}
                    motivo={c.sugestao.motivo}
                    nomeConcurso={`${c.icone ? `${c.icone} ` : ""}${c.orgao} — ${c.cargo}`}
                    compacta
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
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
    </div>
  );
}
