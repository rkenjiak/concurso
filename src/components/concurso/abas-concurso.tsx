"use client";

import type { ComponentProps } from "react";
import { Tabs } from "@/components/ui/tabs";
import { type AbaConcurso, ehAbaConcurso, urlComAba } from "@/lib/aba-concurso";

/**
 * Abas do detalhe do concurso (#77). A aba inicial vem de `?aba=` (lida no servidor, então o
 * primeiro HTML já sai na aba certa) e cada troca é gravada na URL com `history.replaceState`:
 * sem requisição ao servidor (ao contrário de `router.replace`) e sem encher o histórico.
 */
export function AbasConcurso({
  abaInicial,
  ...props
}: Omit<ComponentProps<typeof Tabs>, "defaultValue" | "value" | "onValueChange"> & {
  abaInicial: AbaConcurso;
}) {
  return (
    <Tabs
      {...props}
      defaultValue={abaInicial}
      onValueChange={(aba) => {
        if (!ehAbaConcurso(aba)) return;
        window.history.replaceState(null, "", urlComAba(window.location.href, aba));
      }}
    />
  );
}
