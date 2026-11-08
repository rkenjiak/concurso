import type { Criticidade } from "@/domain/prazos";

/**
 * Mapa único de cores de urgência (#100): prazos/calendário ({@link Criticidade}) e contagem de
 * provas (via `urgenciaContagem`) usam as mesmas classes. Strings literais, para o Tailwind.
 */
export const COR_URGENCIA: Readonly<
  Record<Criticidade, { borda: string; bordaEsquerda: string; fundo: string }>
> = {
  ALTA: {
    borda: "border-destructive",
    bordaEsquerda: "border-l-destructive",
    fundo: "bg-destructive/10 text-destructive",
  },
  MEDIA: {
    borda: "border-aviso",
    bordaEsquerda: "border-l-aviso",
    fundo: "bg-aviso/15 text-aviso-foreground",
  },
  NORMAL: { borda: "border-border", bordaEsquerda: "border-l-transparent", fundo: "" },
};
