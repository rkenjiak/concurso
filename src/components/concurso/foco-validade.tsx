"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { BlocoDestacavel } from "@/components/evento/destaque";
import { FOCO_VALIDADE, PARAM_FOCO, urlSemParametro } from "@/lib/aba-concurso";

/**
 * Card Validade como alvo de `?foco=validade` (#100, D2): destino do fim da validade derivado
 * (que não é um evento cadastrado). Outro valor em `?foco=` é ignorado e removido da URL.
 */
export function FocoValidade({ children }: { children: ReactNode }) {
  const foco = useSearchParams().get(PARAM_FOCO);
  const alvo = foco === FOCO_VALIDADE;

  useEffect(() => {
    if (foco !== null && foco !== FOCO_VALIDADE) {
      window.history.replaceState(null, "", urlSemParametro(window.location.href, PARAM_FOCO));
    }
  }, [foco]);

  return (
    <BlocoDestacavel id="validade" alvo={alvo} data-testid="card-validade">
      {children}
    </BlocoDestacavel>
  );
}
