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

interface BotaoConfirmarProps {
  /** Conteúdo do botão que abre a confirmação. */
  children: ReactNode;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar: string;
  destrutivo?: boolean;
  variante?: ComponentProps<typeof Button>["variant"];
  tamanho?: ComponentProps<typeof Button>["size"];
  rotuloAcessivel?: string;
  acao: () => Promise<ResultadoAcao<unknown>>;
  /** Chamado após sucesso (ex.: navegar). */
  aoConcluir?: () => void;
}

/** Botão que pede confirmação antes de executar uma Server Action. */
export function BotaoConfirmar({
  children,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo = false,
  variante = "outline",
  tamanho = "default",
  rotuloAcessivel,
  acao,
  aoConcluir,
}: BotaoConfirmarProps) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (r.ok) {
        setAberto(false);
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
        setAberto(v);
        if (!v) setErro(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant={variante} size={tamanho} aria-label={rotuloAcessivel}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
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
