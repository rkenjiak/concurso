"use client";

import { type ComponentProps, type ReactNode, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ResultadoAcao } from "@/server/actions/resultado";

interface ConfirmacaoProps {
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  /** Rótulo do botão que desiste (padrão: "Cancelar"). */
  rotuloCancelar?: string;
  /** Server Action a executar; ausente = só confirma (ex.: descartar alterações, #100). */
  acao?: () => Promise<ResultadoAcao<unknown>>;
  /** Chamado após sucesso (ex.: navegar). */
  aoConcluir?: () => void;
}

interface BotaoConfirmarProps extends ConfirmacaoProps {
  /** Conteúdo do botão que abre a confirmação. */
  children: ReactNode;
  variante?: ComponentProps<typeof Button>["variant"];
  tamanho?: ComponentProps<typeof Button>["size"];
  rotuloAcessivel?: string;
}

/** Botão que pede confirmação antes de executar uma Server Action. */
export function BotaoConfirmar({
  children,
  variante = "outline",
  tamanho = "default",
  rotuloAcessivel,
  ...confirmacao
}: BotaoConfirmarProps) {
  const [aberto, setAberto] = useState(false);
  return (
    <DialogoConfirmar {...confirmacao} aberto={aberto} aoMudarAberto={setAberto}>
      <AlertDialogTrigger asChild>
        <Button variant={variante} size={tamanho} aria-label={rotuloAcessivel}>
          {children}
        </Button>
      </AlertDialogTrigger>
    </DialogoConfirmar>
  );
}

interface DialogoConfirmarProps extends ConfirmacaoProps {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  /** Gatilho opcional (`AlertDialogTrigger`); sem ele, o diálogo é aberto só pelo estado. */
  children?: ReactNode;
  /** Para onde o foco volta ao fechar (ex.: o botão do menu que abriu a confirmação). */
  focoAoFechar?: () => HTMLElement | null;
  /**
   * Chamado quando o diálogo terminou de fechar (depois da animação), antes de o foco voltar: para
   * fechar o que está por baixo sem disputar o foco com esta camada.
   */
  aoFechado?: () => void;
}

/**
 * Confirmação controlada pelo chamador: serve para abrir a partir de um item de menu (#100, D8),
 * onde o item some com o menu e o estado do diálogo precisa ficar fora dele.
 */
export function DialogoConfirmar({
  aberto,
  aoMudarAberto,
  children,
  focoAoFechar,
  aoFechado,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo = false,
  rotuloCancelar = "Cancelar",
  acao,
  aoConcluir,
}: DialogoConfirmarProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    if (!acao) {
      aoMudarAberto(false);
      aoConcluir?.();
      return;
    }
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        aoMudarAberto(false);
        aoConcluir?.();
      } else {
        setErro(r.erros._form?.[0] ?? "Não foi possível concluir a operação.");
      }
    });
  }

  return (
    <AlertDialog
      open={aberto}
      onOpenChange={(v) => {
        aoMudarAberto(v);
        if (!v) setErro(null);
      }}
    >
      {children}
      <AlertDialogContent
        onCloseAutoFocus={(e) => {
          aoFechado?.();
          const alvo = focoAoFechar?.();
          if (!alvo) return;
          e.preventDefault();
          alvo.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descricao}</AlertDialogDescription>
        </AlertDialogHeader>
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendente}>{rotuloCancelar}</AlertDialogCancel>
          <Button
            variant={destrutivo ? "destructive" : "default"}
            onClick={confirmar}
            disabled={pendente}
          >
            {pendente ? "Aguarde…" : rotuloConfirmar}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
