import { AlertTriangle, Clock, EyeOff, MapPin } from "lucide-react";
import Link from "next/link";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { BadgeSituacao } from "@/components/evento/badge-situacao";
import { COR_URGENCIA } from "@/components/evento/urgencia";
import { Badge } from "@/components/ui/badge";
import { hrefPrazo } from "@/domain/navegacao-concurso";
import { descreverDias, nomePrazo, type Prazo, situacaoPrazo } from "@/domain/prazos";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConcursoDoPrazo, EventoDoPrazo } from "@/server/queries/dashboard";
import { BotaoOcultarPrazo } from "./botao-ocultar-prazo";

type PrazoDashboard = Prazo<EventoDoPrazo, ConcursoDoPrazo>;

const DIA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** "sáb." a partir de `YYYY-MM-DD` (data de calendário, sem conversão de fuso). */
function diaDaSemana(data: string): string {
  return DIA_SEMANA.format(new Date(`${data}T12:00:00Z`));
}

/**
 * Lista de prazos de um grupo do dashboard, com destaque visual por criticidade. Cada item tem a
 * ação de ocultar/reexibir (#44); prazos ocultos (exibidos só com "Mostrar ocultos") aparecem
 * esmaecidos.
 */
export function ListaPrazos({ prazos }: { prazos: readonly PrazoDashboard[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {prazos.map((p) => {
        const nome = nomePrazo(p);
        return (
          <li
            key={p.chave}
            data-oculto={p.oculto || undefined}
            className={cn("flex items-start border-l-4", COR_URGENCIA[p.criticidade].bordaEsquerda)}
          >
            <Link
              href={hrefPrazo(p.concurso.id, p.evento, { de: "dashboard" })}
              className={cn(
                "flex min-w-0 flex-1 gap-3 p-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring",
                p.oculto && "opacity-60",
              )}
            >
              <div className="w-14 shrink-0 text-center">
                <p className="font-semibold text-sm tabular-nums">
                  {formatarData(p.data).slice(0, 5)}
                </p>
                <p className="text-muted-foreground text-xs">{diaDaSemana(p.data)}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {p.criticidade === "ALTA" ? (
                    <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
                  ) : null}
                  <span className="font-medium">{nome}</span>
                  <BadgeSituacao
                    situacao={situacaoPrazo({
                      tipo: p.tipo,
                      dias: p.dias,
                      status: p.concurso.status,
                    })}
                  />
                  {p.oculto ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      <EyeOff aria-hidden />
                      Oculto
                    </Badge>
                  ) : null}
                </div>
                <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
                  <MarcadorConcurso cor={p.concurso.cor} icone={p.concurso.icone} />
                  <span className="min-w-0 truncate">
                    {p.concurso.orgao} — {p.concurso.cargo}
                  </span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
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
                </div>
              </div>
            </Link>
            <div className="shrink-0 p-2">
              <BotaoOcultarPrazo chave={p.chave} oculto={p.oculto} nome={nome} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
