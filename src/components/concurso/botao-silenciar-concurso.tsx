"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { silenciarConcursoAcao } from "@/server/actions/notificacoes";

/**
 * Silencia (ou reativa) as notificações do app e os alarmes do calendário de um concurso (#65).
 * Os eventos continuam no dashboard, no calendário e no feed .ics.
 */
export function BotaoSilenciarConcurso({
  concursoId,
  silenciado,
}: {
  concursoId: number;
  silenciado: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    setErro(null);
    iniciar(async () => {
      const r = await silenciarConcursoAcao(concursoId, !silenciado);
      if (r.ok) router.refresh();
      else setErro(r.erros._form?.[0] ?? "Não foi possível atualizar.");
    });
  }

  const Icone = pendente ? Loader2 : silenciado ? BellOff : Bell;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={alternar}
        disabled={pendente}
        aria-pressed={silenciado}
        title={
          silenciado
            ? "As notificações deste concurso estão silenciadas"
            : "Silenciar notificações e alarmes deste concurso"
        }
      >
        <Icone className={pendente ? "animate-spin" : undefined} aria-hidden />
        {silenciado ? "Silenciado" : "Silenciar"}
      </Button>
      {erro ? (
        <p role="alert" className="w-full text-destructive text-sm">
          {erro}
        </p>
      ) : null}
    </>
  );
}
