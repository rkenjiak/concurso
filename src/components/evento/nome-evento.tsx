import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Nome de um evento com a representação única de "concluído" (#100): ícone de check, texto
 * riscado e o estado no nome acessível ("…, concluído"), igual no calendário e na aba Eventos.
 * Só elementos inline, para não quebrar o `truncate` de quem o contém.
 */
export function NomeEvento({
  nome,
  concluido,
  className,
}: {
  nome: string;
  concluido: boolean;
  className?: string;
}) {
  return (
    <span className={className}>
      {concluido ? (
        <Check className="mr-1 inline size-[1em] shrink-0 align-[-0.125em]" aria-hidden />
      ) : null}
      <span className={cn(concluido && "line-through")}>{nome}</span>
      {concluido ? <span className="sr-only">, concluído</span> : null}
    </span>
  );
}
