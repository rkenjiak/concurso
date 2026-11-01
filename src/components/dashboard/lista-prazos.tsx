import { AlertTriangle, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ROTULO_TIPO_EVENTO } from "@/domain/labels";
import { type Criticidade, descreverDias, type Prazo } from "@/domain/prazos";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConcursoDoPrazo, EventoDoPrazo } from "@/server/queries/dashboard";

type PrazoDashboard = Prazo<EventoDoPrazo, ConcursoDoPrazo>;

export const BORDA_CRITICIDADE: Readonly<Record<Criticidade, string>> = {
  ALTA: "border-l-destructive",
  MEDIA: "border-l-aviso",
  NORMAL: "border-l-transparent",
};

const DIA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

/** "sáb." a partir de `YYYY-MM-DD` (data de calendário, sem conversão de fuso). */
function diaDaSemana(data: string): string {
  return DIA_SEMANA.format(new Date(`${data}T12:00:00Z`));
}

/** Nome exibido: título do evento, rótulo do tipo ou "Fim da validade" (pseudo-evento). */
export function nomePrazo(p: Pick<PrazoDashboard, "derivado" | "titulo" | "tipo">): string {
  if (p.derivado) return "Fim da validade do concurso";
  return p.titulo ?? ROTULO_TIPO_EVENTO[p.tipo];
}

function BadgeCriticidade({ prazo }: { prazo: PrazoDashboard }) {
  if (prazo.dias < 0) return <Badge variant="destructive">Vencido</Badge>;
  if (prazo.criticidade === "ALTA") return <Badge variant="destructive">Urgente</Badge>;
  if (prazo.criticidade === "MEDIA") {
    return <Badge className="bg-aviso/15 text-aviso-foreground">Esta semana</Badge>;
  }
  return prazo.critico ? <Badge variant="outline">Prazo crítico</Badge> : null;
}

/** Lista de prazos de um grupo do dashboard, com destaque visual por criticidade. */
export function ListaPrazos({ prazos }: { prazos: readonly PrazoDashboard[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {prazos.map((p) => {
        const nome = nomePrazo(p);
        return (
          <li key={p.chave} className={cn("border-l-4", BORDA_CRITICIDADE[p.criticidade])}>
            <Link
              href={`/concursos/${p.concurso.id}`}
              className="flex gap-3 p-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
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
                  <BadgeCriticidade prazo={p} />
                </div>
                <p className="truncate text-muted-foreground text-sm">
                  {p.concurso.orgao} — {p.concurso.cargo}
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
          </li>
        );
      })}
    </ul>
  );
}
