"use client";

import { Check, CheckCheck, Clock, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { Button } from "@/components/ui/button";
import type { CorConcurso } from "@/domain/cores";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  dispensarNotificacaoAcao,
  marcarNotificacaoLidaAcao,
  marcarTodasLidasAcao,
} from "@/server/actions/notificacoes";

/** Notificação já pronta para exibir (serializável para o cliente). */
export interface ItemNotificacao {
  chave: string;
  mensagem: string;
  data: string;
  hora: string | null;
  lida: boolean;
  concurso: { id: number; orgao: string; cargo: string; cor: CorConcurso; icone: string | null };
}

type ResultadoSimples = { ok: true } | { ok: false; erros: { _form?: string[] } };

/**
 * Central de notificações (#65): marcar como lida, dispensar e marcar todas como lidas. Abrir o
 * concurso marca a notificação como lida.
 */
export function ListaNotificacoes({ itens }: { itens: readonly ItemNotificacao[] }) {
  const [pendente, iniciar] = useTransition();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const naoLidas = itens.filter((n) => !n.lida).length;

  function executar(chave: string, acao: () => Promise<ResultadoSimples>) {
    setErro(null);
    setEmAndamento(chave);
    iniciar(async () => {
      const r = await acao();
      setEmAndamento(null);
      if (!r.ok) setErro(r.erros._form?.[0] ?? "Não foi possível atualizar a notificação.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {naoLidas === 0
            ? "Tudo lido."
            : `${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"} de ${itens.length}.`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pendente || naoLidas === 0}
          onClick={() => executar("todas", marcarTodasLidasAcao)}
        >
          {emAndamento === "todas" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <CheckCheck aria-hidden />
          )}
          Marcar todas como lidas
        </Button>
      </div>
      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border" data-testid="lista-notificacoes">
        {itens.map((n) => (
          <li
            key={n.chave}
            data-lida={n.lida || undefined}
            className={cn(
              "flex items-start gap-2 border-l-4",
              n.lida ? "border-l-transparent" : "border-l-primary bg-primary/5",
            )}
          >
            <Link
              href={`/concursos/${n.concurso.id}`}
              onClick={() => {
                if (!n.lida) void marcarNotificacaoLidaAcao(n.chave);
              }}
              className="min-w-0 flex-1 space-y-1 p-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <p className={cn("font-medium", n.lida && "text-muted-foreground")}>
                {n.lida ? null : <span className="sr-only">Não lida: </span>}
                {n.mensagem}
              </p>
              <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <MarcadorConcurso cor={n.concurso.cor} icone={n.concurso.icone} />
                <span className="min-w-0 truncate">
                  {n.concurso.orgao} — {n.concurso.cargo}
                </span>
              </p>
              <p className="flex flex-wrap gap-x-3 text-muted-foreground text-xs">
                <span>{formatarData(n.data)}</span>
                {n.hora ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" aria-hidden />
                    {n.hora}
                  </span>
                ) : null}
              </p>
            </Link>
            <div className="flex shrink-0 gap-1 p-2">
              {n.lida ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  disabled={pendente}
                  aria-label={`Marcar como lida: ${n.mensagem}`}
                  title="Marcar como lida"
                  onClick={() => executar(n.chave, () => marcarNotificacaoLidaAcao(n.chave))}
                >
                  {emAndamento === n.chave ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Check aria-hidden />
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                disabled={pendente}
                aria-label={`Dispensar: ${n.mensagem}`}
                title="Dispensar"
                onClick={() => executar(n.chave, () => dispensarNotificacaoAcao(n.chave))}
              >
                <X aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
