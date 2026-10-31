import type { ReactNode } from "react";

interface CabecalhoPaginaProps {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}

export function CabecalhoPagina({ titulo, descricao, acoes }: CabecalhoPaginaProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">{titulo}</h1>
        {descricao ? <p className="text-muted-foreground text-sm">{descricao}</p> : null}
      </div>
      {acoes}
    </header>
  );
}
