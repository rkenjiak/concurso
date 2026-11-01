import type { CSSProperties } from "react";
import { type CorConcurso, ROTULO_COR_CONCURSO, varCorConcurso } from "@/domain/cores";
import { cn } from "@/lib/utils";

/** Estilo que expõe a cor do concurso como `--cor-concurso` (para `bg-(--cor-concurso)` etc.). */
export function estiloCorConcurso(cor: CorConcurso): CSSProperties {
  return { "--cor-concurso": varCorConcurso(cor) } as CSSProperties;
}

/**
 * Marcador de identificação do concurso (#46): ponto na cor do concurso e, se houver, o ícone.
 * Decorativo por padrão (o nome do concurso está no texto ao lado); com `rotulado`, anuncia a cor
 * para leitores de tela.
 */
export function MarcadorConcurso({
  cor,
  icone,
  tamanho = "md",
  rotulado = false,
  className,
}: {
  cor: CorConcurso;
  icone?: string | null;
  tamanho?: "sm" | "md";
  rotulado?: boolean;
  className?: string;
}) {
  return (
    <span
      data-cor-concurso={cor}
      className={cn("inline-flex shrink-0 items-center gap-1 align-middle", className)}
      style={estiloCorConcurso(cor)}
      {...(rotulado
        ? {
            role: "img",
            "aria-label": `Cor ${ROTULO_COR_CONCURSO[cor]}${icone ? `, ${icone}` : ""}`,
          }
        : { "aria-hidden": true })}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-(--cor-concurso)",
          tamanho === "sm" ? "size-2" : "size-2.5",
        )}
      />
      {icone ? (
        <span className={cn("leading-none", tamanho === "sm" ? "text-xs" : "text-sm")}>
          {icone}
        </span>
      ) : null}
    </span>
  );
}
