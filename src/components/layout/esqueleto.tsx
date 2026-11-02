import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Esqueletos de carregamento (#73). Usados pelos `loading.tsx`: o fallback é pré-carregado, então
 * a navegação troca a tela na hora, em vez de ficar parada até a resposta do servidor chegar.
 * Imitam a forma das páginas (cabeçalho + cards) para evitar saltos grandes quando o conteúdo
 * entra. A região inteira é anunciada uma vez como "Carregando…"; os blocos são decorativos.
 */

/** Bloco cinza pulsante. */
export function Bloco({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Card vazio com a mesma borda e o mesmo raio do `Card`. */
function CardEsqueleto({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn("space-y-3 rounded-xl p-4 ring-1 ring-foreground/10", className)}
    >
      {children}
    </div>
  );
}

function Regiao({ children }: { children: ReactNode }) {
  return (
    <div role="status" data-testid="esqueleto" className="space-y-6">
      <span className="sr-only">Carregando…</span>
      {children}
    </div>
  );
}

/** Título e descrição, no formato do `CabecalhoPagina`. */
function Cabecalho() {
  return (
    <div className="space-y-2">
      <Bloco className="h-8 w-48" />
      <Bloco className="h-4 w-72 max-w-full" />
    </div>
  );
}

/** Esqueleto genérico: cabeçalho e uma lista de cards (dashboard, listas, formulários). */
export function EsqueletoPagina({ cards = 3 }: { cards?: number }) {
  return (
    <Regiao>
      <Cabecalho />
      <div className="space-y-3">
        {Array.from({ length: cards }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, sem reordenação
          <CardEsqueleto key={i}>
            <Bloco className="h-5 w-2/5" />
            <Bloco className="h-4 w-3/5" />
            <Bloco className="h-3 w-1/4" />
          </CardEsqueleto>
        ))}
      </div>
    </Regiao>
  );
}

/** Detalhe do concurso: voltar, título com ações, abas e o card de visão geral. */
export function EsqueletoDetalhe() {
  return (
    <Regiao>
      <Bloco className="h-4 w-24" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Bloco className="h-8 w-64 max-w-full" />
          <Bloco className="h-5 w-48" />
          <Bloco className="h-5 w-28 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Bloco className="h-9 w-24" />
          <Bloco className="h-9 w-24" />
        </div>
      </div>
      <Bloco className="h-9 w-full sm:w-96" />
      <CardEsqueleto>
        <Bloco className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, sem reordenação
            <div key={i} className="space-y-1.5">
              <Bloco className="h-3 w-16" />
              <Bloco className="h-4 w-24" />
            </div>
          ))}
        </div>
      </CardEsqueleto>
    </Regiao>
  );
}

/** Calendário: cabeçalho, navegação do mês e a grade (agenda no celular). */
export function EsqueletoCalendario() {
  return (
    <Regiao>
      <Cabecalho />
      <CardEsqueleto className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Bloco className="h-6 w-40" />
          <div className="flex gap-1">
            <Bloco className="size-9" />
            <Bloco className="h-9 w-16" />
            <Bloco className="size-9" />
          </div>
        </div>
        <div className="hidden grid-cols-7 gap-1 md:grid">
          {Array.from({ length: 35 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: grade fixa, sem reordenação
            <Bloco key={i} className="h-20" />
          ))}
        </div>
        <div className="space-y-2 md:hidden">
          {Array.from({ length: 5 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa, sem reordenação
            <Bloco key={i} className="h-12" />
          ))}
        </div>
      </CardEsqueleto>
    </Regiao>
  );
}
