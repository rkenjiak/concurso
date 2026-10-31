import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CampoProps {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  erro?: string;
  dica?: string;
  className?: string;
  children: ReactNode;
}

/** Rótulo + controle + mensagem de erro/dica, com ids para `aria-describedby`. */
export function Campo({ id, rotulo, obrigatorio, erro, dica, className, children }: CampoProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : dica ? (
        <p id={`${id}-dica`} className="text-muted-foreground text-xs">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

/** Props de acessibilidade para o controle de um {@link Campo}. */
export function ariaCampo(id: string, erro?: string, dica?: string) {
  return {
    id,
    "aria-invalid": erro ? true : undefined,
    "aria-describedby": erro ? `${id}-erro` : dica ? `${id}-dica` : undefined,
  } as const;
}
