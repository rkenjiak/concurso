"use client";

import { BellOff, Clock, Lightbulb, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Status } from "@/domain/enums";
import { ROTULO_STATUS } from "@/domain/labels";
import { DIAS_LEMBRAR_DEPOIS } from "@/domain/sugestao-status";
import { cn } from "@/lib/utils";
import { dispensarPendenciaStatus, responderPendenciaStatus } from "@/server/actions/status";

export interface RespostaExibida {
  id: string;
  rotulo: string;
  para: Status | null;
}

/**
 * Pendência de status (#65, #85): pergunta o que aconteceu quando um evento importante chega ou
 * passa. Cada resposta usa a transição validada e grava o histórico; "Lembrar depois" esconde a
 * pergunta por alguns dias e "Não perguntar mais" a dispensa (ambos ficam salvos).
 */
export function SugestaoStatus({
  concursoId,
  chave,
  pergunta,
  motivo,
  respostas,
  nomeConcurso,
  compacta = false,
}: {
  concursoId: number;
  chave: string;
  pergunta: string;
  motivo: string;
  respostas: readonly RespostaExibida[];
  /** Exibido na versão compacta (dashboard). */
  nomeConcurso?: string;
  compacta?: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [escondida, setEscondida] = useState(false);
  if (escondida) return null;

  function executar(acao: () => Promise<{ ok: boolean; erros?: { _form?: string[] } }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (r.ok) setEscondida(true);
      else setErro(r.erros?._form?.[0] ?? "Não foi possível concluir a operação.");
    });
  }

  const unica = respostas.length === 1 ? respostas[0] : undefined;

  return (
    <section
      aria-label={nomeConcurso ? `${pergunta} — ${nomeConcurso}` : pergunta}
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
          {motivo} <strong>{pergunta}</strong>
          {unica?.para ? (
            <span className="text-muted-foreground"> ({ROTULO_STATUS[unica.para]})</span>
          ) : null}
        </p>
        {erro ? (
          <p role="alert" className="text-destructive">
            {erro}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {respostas.map((r, i) => (
          <Button
            key={r.id}
            type="button"
            size="sm"
            variant={i === 0 ? "default" : "outline"}
            onClick={() => executar(() => responderPendenciaStatus(concursoId, chave, r.id))}
            disabled={pendente}
            title={r.para ? `Mudar o status para ${ROTULO_STATUS[r.para]}` : "Manter o status"}
          >
            {pendente && i === 0 ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {r.rotulo}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => executar(() => dispensarPendenciaStatus(concursoId, chave, "lembrar"))}
          disabled={pendente}
          title={`Perguntar de novo em ${DIAS_LEMBRAR_DEPOIS} dias`}
        >
          <Clock aria-hidden />
          Lembrar depois
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => executar(() => dispensarPendenciaStatus(concursoId, chave, "dispensar"))}
          disabled={pendente}
        >
          <BellOff aria-hidden />
          Não perguntar mais
        </Button>
      </div>
    </section>
  );
}
