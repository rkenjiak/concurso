import { ArrowRight } from "lucide-react";
import { formatarDataHora } from "@/lib/format";
import type { StatusHistorico } from "@/server/db/schema";
import { BadgeStatus } from "./badge-status";

/** Linha do tempo do histórico de status (mais recente primeiro). */
export function TimelineStatus({ historico }: { historico: readonly StatusHistorico[] }) {
  if (historico.length === 0) {
    return <p className="text-muted-foreground text-sm">Sem registros de status.</p>;
  }
  const registros = [...historico].reverse();
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {registros.map((h) => (
        <li key={h.id} className="relative">
          <span
            className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary"
            aria-hidden
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {h.de ? (
              <>
                <BadgeStatus status={h.de} />
                <ArrowRight className="size-3.5 text-muted-foreground" aria-label="para" />
              </>
            ) : (
              <span className="text-muted-foreground text-xs">Cadastrado como</span>
            )}
            <BadgeStatus status={h.para} />
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            <time dateTime={h.alteradoEm.toISOString()}>{formatarDataHora(h.alteradoEm)}</time>
          </p>
          {h.observacao ? <p className="mt-1 text-sm">{h.observacao}</p> : null}
        </li>
      ))}
    </ol>
  );
}
