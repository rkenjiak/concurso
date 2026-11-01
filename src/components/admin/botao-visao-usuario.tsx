"use client";

import { ArrowLeftRight } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alternarVisaoAcao } from "@/server/actions/visao";

/** Volta para a visão usuário (atalho da faixa "Modo admin", #50). */
export function BotaoVisaoUsuario({ className }: { className?: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          await alternarVisaoAcao("usuario");
        })
      }
    >
      <ArrowLeftRight aria-hidden />
      Ir para a visão usuário
    </Button>
  );
}
