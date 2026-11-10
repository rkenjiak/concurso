"use client";

import { usePathname } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TIPO_FEEDBACK, type TipoFeedback } from "@/domain/enums";
import { MENSAGEM_FEEDBACK_MAX, MENSAGEM_FEEDBACK_MIN, normalizarPagina } from "@/domain/feedback";
import { ROTULO_TIPO_FEEDBACK } from "@/domain/labels";
import { cn } from "@/lib/utils";
import { versao } from "@/lib/versao";
import { enviarFeedbackAcao } from "@/server/actions/feedback";
import type { ErrosAcao } from "@/server/actions/resultado";

interface DialogoFeedbackProps {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  /** Para onde o foco volta ao fechar (o gatilho do menu, que some com ele). */
  focoAoFechar?: () => HTMLElement | null;
}

/**
 * Envio de feedback (#117): tipo, mensagem e, anexados pelo servidor, a página atual (sem query
 * string), a versão do app e o navegador. Sempre em nome de quem está logado. Ao enviar, avisa,
 * fecha e limpa.
 */
export function DialogoFeedback({ aberto, aoMudarAberto, focoAoFechar }: DialogoFeedbackProps) {
  const { avisar } = useAvisos();
  const pathname = usePathname();
  const pagina = normalizarPagina(pathname);
  const id = useId();
  const [tipo, setTipo] = useState<TipoFeedback>("SUGESTAO");
  const [mensagem, setMensagem] = useState("");
  const [erros, setErros] = useState<ErrosAcao>({});
  const [pendente, iniciar] = useTransition();

  function limpar() {
    setTipo("SUGESTAO");
    setMensagem("");
    setErros({});
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const tamanho = mensagem.trim().length;
    if (tamanho < MENSAGEM_FEEDBACK_MIN) {
      setErros({ mensagem: [`Escreva pelo menos ${MENSAGEM_FEEDBACK_MIN} caracteres.`] });
      document.getElementById(`${id}-mensagem`)?.focus();
      return;
    }
    iniciar(async () => {
      const r = await enviarFeedbackAcao({ tipo, mensagem, pagina: pathname });
      if (!r.ok) {
        setErros(r.erros);
        return;
      }
      avisar({ texto: "Feedback enviado. Obrigado!" });
      limpar();
      aoMudarAberto(false);
    });
  }

  const erroMensagem = erros.mensagem?.[0];
  const erroForm = erros._form?.[0] ?? erros.tipo?.[0];
  const restante = MENSAGEM_FEEDBACK_MAX - mensagem.length;

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (pendente) return;
        aoMudarAberto(v);
        if (!v) setErros({});
      }}
    >
      <DialogContent
        onCloseAutoFocus={(e) => {
          const alvo = focoAoFechar?.();
          if (!alvo) return;
          e.preventDefault();
          alvo.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Enviar feedback</DialogTitle>
          <DialogDescription>
            Relate um problema, sugira uma melhoria ou diga o que achou. Quem administra o app lê
            tudo.
          </DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} onSubmit={enviar} className="grid gap-4" noValidate>
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-medium text-sm">Tipo</legend>
            <div className="flex flex-wrap gap-2">
              {TIPO_FEEDBACK.map((t) => (
                <label
                  key={t}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 pointer-coarse:h-11",
                    tipo === t ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-tipo`}
                    value={t}
                    checked={tipo === t}
                    onChange={() => setTipo(t)}
                    className="accent-primary"
                  />
                  {ROTULO_TIPO_FEEDBACK[t]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-mensagem`}>Mensagem</Label>
            <Textarea
              id={`${id}-mensagem`}
              value={mensagem}
              onChange={(e) => {
                setMensagem(e.target.value);
                if (erroMensagem) setErros({});
              }}
              maxLength={MENSAGEM_FEEDBACK_MAX}
              rows={5}
              required
              aria-invalid={erroMensagem ? true : undefined}
              aria-describedby={`${id}-contador ${erroMensagem ? `${id}-erro` : ""}`.trim()}
              className="max-h-[40dvh] min-h-28"
            />
            <div className="flex items-start justify-between gap-3 text-xs">
              {erroMensagem ? (
                <p id={`${id}-erro`} role="alert" className="text-destructive text-sm">
                  {erroMensagem}
                </p>
              ) : (
                <span className="text-muted-foreground">
                  Entre {MENSAGEM_FEEDBACK_MIN} e {MENSAGEM_FEEDBACK_MAX} caracteres.
                </span>
              )}
              <span id={`${id}-contador`} className="shrink-0 text-muted-foreground tabular-nums">
                {mensagem.length}/{MENSAGEM_FEEDBACK_MAX}
                <span className="sr-only"> caracteres ({restante} restantes)</span>
              </span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Vamos anexar: a página atual
            {pagina ? (
              <>
                {" "}
                (<code>{pagina}</code>)
              </>
            ) : null}
            , a versão do app (v{versao}) e o navegador. Sem filtros nem buscas da página.
          </p>
          {erroForm ? (
            <p role="alert" className="text-destructive text-sm">
              {erroForm}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => aoMudarAberto(false)}
            disabled={pendente}
          >
            Cancelar
          </Button>
          <Button type="submit" form={`${id}-form`} disabled={pendente}>
            {pendente ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
