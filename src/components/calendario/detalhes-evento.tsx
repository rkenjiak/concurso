"use client";

import { ArrowRight, CalendarDays, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { nomePrazo } from "@/components/dashboard/lista-prazos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatarData, formatarDataLonga } from "@/lib/format";
import type { ItemDoCalendario } from "@/server/queries/calendario";

function BadgeSituacao({ item }: { item: ItemDoCalendario }) {
  if (item.concluido) return <Badge variant="secondary">Concluído</Badge>;
  if (item.esmaecido) return null;
  if (item.criticidade === "ALTA") {
    return <Badge variant="destructive">{item.dias < 0 ? "Vencido" : "Urgente"}</Badge>;
  }
  if (item.criticidade === "MEDIA") return <Badge variant="outline">Esta semana</Badge>;
  return null;
}

/**
 * Detalhes de um item do calendário em diálogo (Radix: Esc/clique fora fecham, foco preso e
 * devolvido ao gatilho). `children` é o gatilho — um único `<button>` —, que recebe os atributos
 * de abertura; navegar ao concurso fica a cargo do botão "Ir para o concurso".
 */
export function DetalhesEvento({
  item,
  proximos,
  children,
}: {
  item: ItemDoCalendario;
  /** Próximos eventos pendentes do mesmo concurso (resumo). */
  proximos: readonly ItemDoCalendario[];
  children: ReactElement;
}) {
  const nome = nomePrazo(item);
  const local = item.evento?.local;
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle className={item.concluido ? "line-through" : undefined}>{nome}</DialogTitle>
          <DialogDescription>
            {item.concurso.orgao} — {item.concurso.cargo}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          <BadgeStatus status={item.concurso.status} />
          <BadgeSituacao item={item} />
        </div>

        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
          <dt>
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Data</span>
          </dt>
          <dd className="first-letter:uppercase">{formatarDataLonga(item.data)}</dd>
          {item.hora ? (
            <>
              <dt>
                <Clock className="size-4 text-muted-foreground" aria-hidden />
                <span className="sr-only">Horário</span>
              </dt>
              <dd className="tabular-nums">{item.hora}</dd>
            </>
          ) : null}
          {local ? (
            <>
              <dt>
                <MapPin className="size-4 text-muted-foreground" aria-hidden />
                <span className="sr-only">Local</span>
              </dt>
              <dd>{local}</dd>
            </>
          ) : null}
        </dl>

        {proximos.length > 0 ? (
          <section aria-labelledby={`proximos-${item.chave}`} className="space-y-1.5">
            <h3
              id={`proximos-${item.chave}`}
              className="font-medium text-muted-foreground text-xs uppercase"
            >
              Próximos eventos no mês
            </h3>
            <ul className="space-y-1">
              {proximos.map((p) => (
                <li key={p.chave} className="flex gap-2">
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {formatarData(p.data).slice(0, 5)}
                    {p.hora ? ` ${p.hora}` : null}
                  </span>
                  <span className="min-w-0 truncate">{nomePrazo(p)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DialogFooter>
          <Button asChild>
            <Link href={`/concursos/${item.concurso.id}`}>
              Ir para o concurso
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
