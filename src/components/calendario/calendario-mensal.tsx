import { AlertTriangle, Check, Clock } from "lucide-react";
import Link from "next/link";
import { BORDA_CRITICIDADE, nomePrazo } from "@/components/dashboard/lista-prazos";
import { agruparPorData, DIAS_SEMANA, type DiaGrade } from "@/domain/calendario";
import { formatarDataLonga } from "@/lib/format";
import type { DataISO } from "@/lib/tz";
import { cn } from "@/lib/utils";
import type { ItemDoCalendario } from "@/server/queries/calendario";

const NOME_DIA_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

function rotuloItem(item: ItemDoCalendario): string {
  const partes = [nomePrazo(item), `${item.concurso.orgao} — ${item.concurso.cargo}`];
  if (item.hora) partes.push(item.hora);
  if (item.concluido) partes.push("concluído");
  if (!item.esmaecido && item.criticidade === "ALTA") {
    partes.push(item.dias < 0 ? "vencido" : "urgente");
  }
  return partes.join(" · ");
}

/** Item compacto da grade (desktop). */
function ItemGrade({ item }: { item: ItemDoCalendario }) {
  return (
    <li>
      <Link
        href={`/concursos/${item.concurso.id}`}
        title={rotuloItem(item)}
        aria-label={rotuloItem(item)}
        data-criticidade={item.criticidade}
        data-esmaecido={item.esmaecido || undefined}
        className={cn(
          "block truncate rounded border-l-4 bg-muted/60 px-1.5 py-0.5 text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
          BORDA_CRITICIDADE[item.criticidade],
          item.criticidade === "ALTA" && "bg-destructive/10 font-medium text-destructive",
          item.criticidade === "MEDIA" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
          item.esmaecido && "text-muted-foreground opacity-60",
          item.concluido && "line-through",
        )}
      >
        {item.hora ? <span className="tabular-nums">{item.hora} </span> : null}
        {nomePrazo(item)} · {item.concurso.orgao}
      </Link>
    </li>
  );
}

/** Grade mensal (a partir de `md`): semanas de domingo a sábado. */
export function GradeMes({
  grade,
  itens,
  titulo,
}: {
  grade: DiaGrade[][];
  itens: readonly ItemDoCalendario[];
  titulo: string;
}) {
  const porData = agruparPorData(itens);
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">{titulo}</caption>
      <thead>
        <tr>
          {DIAS_SEMANA.map((d, i) => (
            <th
              key={d}
              scope="col"
              abbr={NOME_DIA_SEMANA[i]}
              className="pb-2 font-medium text-muted-foreground text-xs uppercase"
            >
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grade.map((semana) => (
          <tr key={semana[0]?.data}>
            {semana.map((dia) => (
              <CelulaDia key={dia.data} dia={dia} itens={porData.get(dia.data) ?? []} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CelulaDia({ dia, itens }: { dia: DiaGrade; itens: readonly ItemDoCalendario[] }) {
  return (
    <td
      aria-current={dia.hoje ? "date" : undefined}
      aria-label={formatarDataLonga(dia.data)}
      data-data={dia.data}
      className={cn(
        "h-28 border p-1 align-top",
        !dia.doMes && "bg-muted/30 text-muted-foreground",
        dia.hoje && "bg-primary/5 ring-2 ring-primary ring-inset",
      )}
    >
      <span
        className={cn(
          "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
          dia.hoje && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {dia.dia}
      </span>
      {dia.doMes && itens.length > 0 ? (
        <ul className="space-y-1">
          {itens.map((item) => (
            <ItemGrade key={item.chave} item={item} />
          ))}
        </ul>
      ) : null}
    </td>
  );
}

/** Agenda do mês (celular): só os dias com itens, em ordem. */
export function AgendaMes({ itens, hoje }: { itens: readonly ItemDoCalendario[]; hoje: DataISO }) {
  const porData = agruparPorData(itens);
  if (porData.size === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground text-sm">Nenhum evento neste mês.</p>
    );
  }
  return (
    <ol className="space-y-4">
      {[...porData].map(([data, doDia]) => (
        <li key={data} aria-current={data === hoje ? "date" : undefined}>
          <h3
            className={cn(
              "mb-1 font-medium text-sm first-letter:uppercase",
              data === hoje && "text-primary",
            )}
          >
            {formatarDataLonga(data)}
            {data === hoje ? " · hoje" : null}
          </h3>
          <ul className="divide-y rounded-lg border">
            {doDia.map((item) => (
              <li
                key={item.chave}
                className={cn("border-l-4", BORDA_CRITICIDADE[item.criticidade])}
              >
                <Link
                  href={`/concursos/${item.concurso.id}`}
                  className={cn(
                    "flex gap-2 p-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring",
                    item.esmaecido && "text-muted-foreground opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className={cn(
                        "flex items-center gap-1.5 font-medium",
                        item.concluido && "line-through",
                      )}
                    >
                      {item.criticidade === "ALTA" ? (
                        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
                      ) : null}
                      {item.concluido ? (
                        <Check className="size-4 shrink-0" aria-label="Concluído" />
                      ) : null}
                      {nomePrazo(item)}
                    </p>
                    <p className="truncate text-muted-foreground text-sm">
                      {item.concurso.orgao} — {item.concurso.cargo}
                    </p>
                  </div>
                  {item.hora ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                      <Clock className="size-3" aria-hidden />
                      {item.hora}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
