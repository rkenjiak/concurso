import { ArrowRight } from "lucide-react";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { formatarDataHora } from "@/lib/format";
import type { StatusHistoricoCompartilhado } from "@/server/queries/compartilhamento";

/**
 * Linha do tempo pública do histórico de status (mais recente primeiro, #129). Aceita
 * estritamente {@link StatusHistoricoCompartilhado} — nunca `observacao` nem IDs internos.
 */
export function TimelineStatusPublica({
  historico,
}: {
  historico: readonly StatusHistoricoCompartilhado[];
}) {
  if (historico.length === 0) {
    return <p className="text-muted-foreground text-sm">Sem registros de status.</p>;
  }
  const ocorrencias = new Map<string, number>();
  const registros = [...historico].reverse().map((h) => {
    const base = `${h.alteradoEm.getTime()}-${h.de ?? ""}-${h.para}`;
    const n = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, n);
    return { ...h, chave: `${base}-${n}` };
  });
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {registros.map((h) => (
        <li key={h.chave} className="relative">
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
        </li>
      ))}
    </ol>
  );
}
