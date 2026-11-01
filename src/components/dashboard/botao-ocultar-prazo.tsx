"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alternarPrazoOculto } from "@/server/actions/dashboard";

interface BotaoOcultarPrazoProps {
  /** Chave do prazo (`evento-<id>` ou `validade-<concursoId>`). */
  chave: string;
  /** Estado atual: `true` mostra a ação de reexibir. */
  oculto: boolean;
  /** Nome do prazo, para o rótulo acessível. */
  nome: string;
}

/** Oculta ou reexibe um prazo no dashboard (#44). A preferência é gravada no banco. */
export function BotaoOcultarPrazo({ chave, oculto, nome }: BotaoOcultarPrazoProps) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const rotulo = oculto ? `Mostrar "${nome}" no dashboard` : `Ocultar "${nome}" do dashboard`;

  function alternar() {
    setErro(null);
    iniciar(async () => {
      const r = await alternarPrazoOculto(chave, !oculto);
      if (r.ok) router.refresh();
      else setErro(r.erros._form?.[0] ?? "Não foi possível atualizar o prazo.");
    });
  }

  const Icone = pendente ? Loader2 : oculto ? Eye : EyeOff;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={alternar}
        disabled={pendente}
        aria-label={rotulo}
        title={oculto ? "Mostrar no dashboard" : "Ocultar do dashboard"}
      >
        <Icone className={pendente ? "animate-spin" : undefined} aria-hidden />
      </Button>
      {erro ? (
        <p role="alert" className="max-w-40 text-right text-destructive text-xs">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
