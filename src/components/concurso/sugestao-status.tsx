"use client";

import { Lightbulb, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Status } from "@/domain/enums";
import { ROTULO_STATUS } from "@/domain/labels";
import { cn } from "@/lib/utils";
import { aplicarSugestaoStatus } from "@/server/actions/status";

/**
 * Sugestão do próximo status (#65): só sugere. "Aplicar" usa a transição validada e grava o
 * histórico com o motivo; "Agora não" só esconde a sugestão nesta tela.
 */
export function SugestaoStatus({
  concursoId,
  para,
  motivo,
  nomeConcurso,
  compacta = false,
}: {
  concursoId: number;
  para: Status;
  motivo: string;
  /** Exibido na versão compacta (dashboard). */
  nomeConcurso?: string;
  compacta?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [escondida, setEscondida] = useState(false);
  if (escondida) return null;

  function aplicar() {
    setErro(null);
    iniciar(async () => {
      const r = await aplicarSugestaoStatus(concursoId, para);
      if (r.ok) router.refresh();
      else setErro(r.erros._form?.[0] ?? "Não foi possível mudar o status.");
    });
  }

  return (
    <div
      role="status"
      data-testid="sugestao-status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-aviso bg-aviso/10 p-3 text-sm",
        compacta && "bg-transparent",
      )}
    >
      <Lightbulb className="size-4 shrink-0 text-aviso-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        {nomeConcurso ? <p className="truncate font-medium">{nomeConcurso}</p> : null}
        <p>
          {motivo} Mudar o status para <strong>{ROTULO_STATUS[para]}</strong>?
        </p>
        {erro ? (
          <p role="alert" className="text-destructive">
            {erro}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={aplicar} disabled={pendente}>
          {pendente ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Aplicar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEscondida(true)}
          disabled={pendente}
        >
          Agora não
        </Button>
      </div>
    </div>
  );
}
