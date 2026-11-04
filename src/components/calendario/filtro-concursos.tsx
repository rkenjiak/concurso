"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { Button } from "@/components/ui/button";
import type { MesISO } from "@/domain/calendario";
import type { CorConcurso } from "@/domain/cores";
import {
  alternarConcurso,
  concursoVisivel,
  hrefCalendario,
  type SelecaoConcursos,
} from "@/domain/navegacao-calendario";
import { cn } from "@/lib/utils";

export interface ConcursoDaLegenda {
  id: number;
  orgao: string;
  cargo: string;
  cor: CorConcurso;
  icone: string | null;
}

/**
 * Legenda cor/ícone → concurso (#46) que também filtra o calendário (#83): cada concurso é um
 * toggle (`aria-pressed`), com "só este" ao lado e "Mostrar todos" quando há filtro. A seleção
 * vai para a URL (`?concursos=`), que os links de navegação entre meses preservam.
 */
export function FiltroConcursos({
  mes,
  concursos,
  todos,
  selecao,
}: {
  mes: MesISO;
  /** Concursos listados: os com itens no mês e os selecionados. */
  concursos: readonly ConcursoDaLegenda[];
  /** IDs de todos os concursos do usuário (desligar um, partindo de "todos", mostra os demais). */
  todos: readonly number[];
  selecao: SelecaoConcursos;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const ir = (nova: SelecaoConcursos) =>
    iniciar(() => router.push(hrefCalendario(mes, nova), { scroll: false }));

  if (concursos.length === 0 && selecao === null) return null;
  const exibidos = selecao === null ? todos.length : selecao.length;

  return (
    <section aria-label="Filtro de concursos" aria-busy={pendente} className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <h3 className="font-medium">Concursos</h3>
        <p className="text-muted-foreground" aria-live="polite">
          {selecao === null
            ? "Mostrando todos. Toque num concurso para ocultá-lo."
            : `Mostrando ${exibidos} de ${todos.length}.`}
        </p>
        {selecao !== null ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => ir(null)}
            disabled={pendente}
          >
            Mostrar todos
          </Button>
        ) : null}
      </div>
      {concursos.length > 0 ? (
        <ul aria-label="Concursos" className="flex flex-wrap gap-1.5 text-xs">
          {concursos.map((c) => {
            const nome = `${c.orgao} — ${c.cargo}`;
            const visivel = concursoVisivel(selecao, c.id);
            // Com um concurso só, "só este" seria o mesmo que "todos".
            const unico = todos.length <= 1 || (selecao?.length === 1 && selecao[0] === c.id);
            return (
              <li
                key={c.id}
                data-concurso-id={c.id}
                className={cn(
                  "inline-flex min-w-0 max-w-full items-center rounded-full border pl-2.5",
                  visivel ? "bg-accent/60" : "border-dashed",
                )}
              >
                <MarcadorConcurso
                  cor={c.cor}
                  icone={c.icone}
                  rotulado
                  className={cn(!visivel && "opacity-50")}
                />
                <button
                  type="button"
                  aria-pressed={visivel}
                  // Desabilitado durante a navegação: dois cliques rápidos partiriam da mesma
                  // seleção antiga e o primeiro se perderia.
                  disabled={pendente}
                  title={visivel ? `Ocultar ${nome}` : `Mostrar ${nome}`}
                  onClick={() => ir(alternarConcurso(selecao, c.id, todos))}
                  className={cn(
                    "inline-flex min-h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-full py-1 pr-2 pl-1.5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                    !visivel && "text-muted-foreground line-through opacity-70",
                  )}
                >
                  {visivel ? (
                    <Check className="size-3 shrink-0" aria-hidden />
                  ) : (
                    <span className="size-3 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">{nome}</span>
                </button>
                {unico ? null : (
                  <button
                    type="button"
                    aria-label={`Mostrar só ${nome}`}
                    title={`Mostrar só ${nome}`}
                    onClick={() => ir([c.id])}
                    disabled={pendente}
                    className="min-h-8 shrink-0 cursor-pointer rounded-full border-l px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    só este
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
