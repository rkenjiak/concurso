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
  acao: () => Promise<ResultadoAcao<unknown>>;
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
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo = false,
  acao,
  aoConcluir,
}: DialogoConfirmarProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
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
        onCloseAutoFocus={
          focoAoFechar
            ? (e) => {
                const alvo = focoAoFechar();
                if (!alvo) return;
                e.preventDefault();
                alvo.focus();
              }
            : undefined
        }
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
          <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
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
