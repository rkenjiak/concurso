"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { Tabs } from "@/components/ui/tabs";
import { ehAbaConcurso, normalizarAba, PARAM_ABA, urlComAba } from "@/lib/aba-concurso";

/**
 * Abas do detalhe do concurso (#77), controladas por `?aba=`. A rota é dinâmica, então o
 * `useSearchParams` já vale na renderização do servidor e o primeiro HTML sai na aba certa. Cada
 * troca é gravada com `history.replaceState`, que o Next repassa ao `useSearchParams`: sem
 * requisição ao servidor (ao contrário de `router.replace`) e sem encher o histórico. Controladas
 * (e não `defaultValue`) porque, ao voltar para a página, o Next reaproveita a renderização da
 * primeira visita, que pode ter outra aba.
 */
export function AbasConcurso(
  props: Omit<ComponentProps<typeof Tabs>, "defaultValue" | "value" | "onValueChange">,
) {
  const aba = normalizarAba(useSearchParams().get(PARAM_ABA) ?? undefined);
  return (
    <Tabs
      {...props}
      value={aba}
      onValueChange={(nova) => {
        if (!ehAbaConcurso(nova)) return;
        window.history.replaceState(null, "", urlComAba(window.location.href, nova));
      }}
    />
  );
}
