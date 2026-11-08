"use client";

import { AlertTriangle, Check, Circle, Clock, EyeOff, MapPin } from "lucide-react";
import Link from "next/link";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { BadgeSituacao } from "@/components/evento/badge-situacao";
import { NomeEvento } from "@/components/evento/nome-evento";
import { BotaoAbrirEvento, usePainelEvento } from "@/components/evento/painel-evento";
import { COR_URGENCIA } from "@/components/evento/urgencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hrefPrazo } from "@/domain/navegacao-concurso";
import { descreverDias, nomePrazo, type Prazo, situacaoPrazo } from "@/domain/prazos";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConcursoDoPrazo, EventoDoPrazo } from "@/server/queries/dashboard";

type PrazoDashboard = Prazo<EventoDoPrazo, ConcursoDoPrazo>;

const DIA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** "sáb." a partir de `YYYY-MM-DD` (data de calendário, sem conversão de fuso). */
function diaDaSemana(data: string): string {
  return DIA_SEMANA.format(new Date(`${data}T12:00:00Z`));
}

/** Concluir na própria linha (#100, D6): ação primária visível; ausente na validade derivada. */
function BotaoConcluir({ prazo, nome }: { prazo: PrazoDashboard; nome: string }) {
  const painel = usePainelEvento();
  // No dashboard só há prazos pendentes: concluído aqui é só o estado otimista.
  const concluido = painel.concluido(prazo.chave, false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 text-muted-foreground hover:text-primary md:size-9"
      aria-label={`Marcar “${nome}” como concluído`}
      aria-pressed={concluido}
      disabled={concluido || painel.gravando(prazo.chave)}
      onClick={(e) => painel.alternarConcluido(prazo.chave, true, e.currentTarget)}
    >
      {concluido ? (
        <Check className="size-5 text-primary" aria-hidden />
      ) : (
        <Circle className="size-5" aria-hidden />
      )}
    </Button>
  );
}

/**
 * Lista de prazos de um grupo do dashboard, com destaque visual por criticidade (#100, D6). Cada
 * linha tem três partes irmãs (sem interativos aninhados): o botão de concluir, a área principal
 * (`<button>` que abre o painel do evento, com ocultar/editar/ver no concurso) e o nome do
 * concurso como link para o evento no concurso. Prazos ocultos (exibidos só com "Mostrar
 * ocultos", #44) aparecem esmaecidos. Precisa de um {@link PainelEventoProvider} acima.
 */
export function ListaPrazos({ prazos }: { prazos: readonly PrazoDashboard[] }) {
  const painel = usePainelEvento();
  return (
    <ul className="divide-y rounded-lg border">
      {prazos.map((p) => {
        const nome = nomePrazo(p);
        const concluido = painel.concluido(p.chave, false);
        return (
          <li
            key={p.chave}
            data-oculto={p.oculto || undefined}
            data-concluido={concluido || undefined}
            className={cn("flex items-start border-l-4", COR_URGENCIA[p.criticidade].bordaEsquerda)}
          >
            <div className="shrink-0 py-1.5 pl-1 md:py-2">
              {p.evento ? (
                <BotaoConcluir prazo={p} nome={nome} />
              ) : (
                <span className="block size-11 md:size-9" aria-hidden />
              )}
            </div>
            <div className={cn("min-w-0 flex-1", p.oculto && "opacity-60")}>
              <BotaoAbrirEvento
                chave={p.chave}
                className="flex w-full cursor-pointer gap-3 rounded-sm py-3 pr-3 pl-1 text-left transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="block w-14 shrink-0 text-center">
                  <span className="block font-semibold text-sm tabular-nums">
                    {formatarData(p.data).slice(0, 5)}
                  </span>
                  <span className="block text-muted-foreground text-xs">{diaDaSemana(p.data)}</span>
                </span>
                <span className="block min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {p.criticidade === "ALTA" ? (
                      <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
                    ) : null}
                    <NomeEvento nome={nome} concluido={concluido} className="font-medium" />
                    <BadgeSituacao
                      situacao={situacaoPrazo({
                        tipo: p.tipo,
                        dias: p.dias,
                        concluido,
                        status: p.concurso.status,
                      })}
                    />
                    {p.oculto ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        <EyeOff aria-hidden />
                        Oculto
                      </Badge>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                    <span>
                      {formatarData(p.data)} · {descreverDias(p.dias)}
                    </span>
                    {p.hora ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        {p.hora}
                      </span>
                    ) : null}
                    {p.evento?.local ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{p.evento.local}</span>
                      </span>
                    ) : null}
                  </span>
                </span>
              </BotaoAbrirEvento>
              {/* Link irmão do botão (D6): o concurso, com o evento destacado na aba Eventos. */}
              <p className="-mt-2 pr-3 pb-3 pl-[4.5rem] text-sm">
                <Link
                  href={hrefPrazo(p.concurso.id, p.evento, { de: "dashboard" })}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <MarcadorConcurso cor={p.concurso.cor} icone={p.concurso.icone} />
                  <span className="min-w-0 truncate">
                    {p.concurso.orgao} — {p.concurso.cargo}
                  </span>
                </Link>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
