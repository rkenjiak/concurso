import { Columns3, List } from "lucide-react";
import Link from "next/link";
import { type FiltrosConcursos, hrefConcursos, type Visao } from "@/lib/schemas/filtros-concursos";
import { cn } from "@/lib/utils";

const OPCOES = [
  { visao: "lista", rotulo: "Lista", icone: List },
  { visao: "quadro", rotulo: "Quadro", icone: Columns3 },
] as const satisfies readonly { visao: Visao; rotulo: string; icone: unknown }[];

/** Alterna entre lista e quadro mantendo busca, filtros e ordenação na URL. */
export function AlternarVisao({ filtros, visao }: { filtros: FiltrosConcursos; visao: Visao }) {
  return (
    <nav aria-label="Visão" className="inline-flex rounded-lg bg-muted p-[3px]">
      {OPCOES.map(({ visao: v, rotulo, icone: Icone }) => {
        const ativa = v === visao;
        return (
          <Link
            key={v}
            href={hrefConcursos(filtros, v)}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "inline-flex h-7 pointer-coarse:h-9 items-center gap-1.5 rounded-md px-2.5 font-medium text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              ativa
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className="size-4" aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
