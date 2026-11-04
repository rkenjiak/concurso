"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MesISO } from "@/domain/calendario";
import {
  hrefCalendario,
  MESES_CURTOS,
  mesesDoAno,
  type SelecaoConcursos,
  textoQuantidadeEventos,
} from "@/domain/navegacao-calendario";
import { formatarMes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Título do mês que abre o seletor de mês e ano (#83): os 12 meses do ano com a quantidade de
 * eventos de cada um (já com o filtro de concursos), e setas para trocar de ano. Cada mês é um
 * link (`?mes=` mais a seleção de concursos), então o seletor funciona igual no desktop e no
 * celular e a URL continua compartilhável. Trocar de ano não vai ao servidor: as contagens de
 * todos os meses chegam prontas.
 */
export function SeletorMes({
  mes,
  mesHoje,
  contagens,
  selecao,
}: {
  mes: MesISO;
  mesHoje: MesISO;
  /** Quantidade de itens por mês (`AAAA-MM`), só os meses com itens. */
  contagens: Readonly<Record<MesISO, number>>;
  selecao: SelecaoConcursos;
}) {
  const anoExibido = Number(mes.slice(0, 4));
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(anoExibido);
  const titulo = formatarMes(mes);

  return (
    <Popover
      open={aberto}
      onOpenChange={(abrir) => {
        setAberto(abrir);
        if (abrir) setAno(anoExibido);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="-ml-2 h-auto px-2 py-1 font-semibold text-lg"
          aria-label={`${titulo}: escolher mês e ano`}
        >
          <span className="first-letter:uppercase">{titulo}</span>
          <ChevronDown aria-hidden className={cn("transition-transform", aberto && "rotate-180")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Escolher mês e ano">
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ano anterior"
            onClick={() => setAno((a) => Math.max(1000, a - 1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="font-semibold tabular-nums" aria-live="polite">
            {ano}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próximo ano"
            onClick={() => setAno((a) => Math.min(9999, a + 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <ul aria-label={`Meses de ${ano}`} className="grid grid-cols-3 gap-1">
          {mesesDoAno(ano).map((m, i) => {
            const n = contagens[m] ?? 0;
            const atual = m === mes;
            return (
              <li key={m}>
                <Link
                  href={hrefCalendario(m, selecao)}
                  onClick={() => setAberto(false)}
                  aria-current={atual ? "page" : undefined}
                  aria-label={`${formatarMes(m)}, ${textoQuantidadeEventos(n)}`}
                  data-mes={m}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center rounded-md border text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                    atual &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    !atual && m === mesHoje && "border-primary",
                    !atual && n === 0 && "text-muted-foreground",
                  )}
                >
                  <span>{MESES_CURTOS[i]}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "text-[0.65rem] tabular-nums leading-none",
                      n === 0 ? "opacity-0" : !atual && "text-primary font-medium",
                    )}
                  >
                    {n === 0 ? "·" : n}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-muted-foreground text-xs">
          O número indica os eventos do mês com o filtro atual.
        </p>
      </PopoverContent>
    </Popover>
  );
}
