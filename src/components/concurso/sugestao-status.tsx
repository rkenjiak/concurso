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
  /** Pede confirmação antes de aplicar (status final, ex.: Desistiu). */
  confirmar?: string;
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
  /** Botão clicado (mostra o indicador nele). */
  const [acao, setAcao] = useState<string | null>(null);
  /** Resposta aguardando confirmação. */
  const [confirmando, setConfirmando] = useState<RespostaExibida | null>(null);
  if (escondida) return null;

  function executar(
    qual: string,
    acaoServidor: () => Promise<{ ok: boolean; erros?: { _form?: string[] } }>,
  ) {
    setErro(null);
    setAcao(qual);
    iniciar(async () => {
      const r = await acaoServidor();
      if (r.ok) setEscondida(true);
      else setErro(r.erros?._form?.[0] ?? "Não foi possível concluir a operação.");
    });
  }

  const unica = respostas.length === 1 ? respostas[0] : undefined;
  const responder = (r: RespostaExibida) =>
    executar(r.id, () => responderPendenciaStatus(concursoId, chave, r.id));
  const carregando = (qual: string) =>
    pendente && acao === qual ? <Loader2 className="animate-spin" aria-hidden /> : null;

  return (
    <section
      aria-label={nomeConcurso ? `${pergunta} — ${nomeConcurso}` : pergunta}
      aria-busy={pendente}
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
        {confirmando?.confirmar ? (
          <p role="alert" className="font-medium">
            {confirmando.confirmar}
          </p>
        ) : null}
        {erro ? (
          <p role="alert" className="text-destructive">
            {erro}
          </p>
        ) : null}
      </div>
      {confirmando ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => responder(confirmando)}
            disabled={pendente}
          >
            {carregando(confirmando.id)}
            Confirmar: {confirmando.rotulo}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmando(null)}
            disabled={pendente}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {respostas.map((r, i) => (
            <Button
              key={r.id}
              type="button"
              size="sm"
              variant={i === 0 ? "default" : "outline"}
              onClick={() => (r.confirmar ? setConfirmando(r) : responder(r))}
              disabled={pendente}
              title={r.para ? `Mudar o status para ${ROTULO_STATUS[r.para]}` : "Manter o status"}
            >
              {carregando(r.id)}
              {r.rotulo}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              executar("lembrar", () => dispensarPendenciaStatus(concursoId, chave, "lembrar"))
            }
            disabled={pendente}
            title={`Perguntar de novo em ${DIAS_LEMBRAR_DEPOIS} dias`}
          >
            {carregando("lembrar") ?? <Clock aria-hidden />}
            Lembrar depois
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              executar("dispensar", () => dispensarPendenciaStatus(concursoId, chave, "dispensar"))
            }
            disabled={pendente}
          >
            {carregando("dispensar") ?? <BellOff aria-hidden />}
            Não perguntar mais
          </Button>
        </div>
      )}
    </section>
  );
}
