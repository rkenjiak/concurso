"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Status } from "@/domain/enums";
import { DESCRICAO_STATUS, ROTULO_STATUS } from "@/domain/labels";
import { alterarStatus, desfazerUltimoStatus } from "@/server/actions/status";
import { BotaoConfirmar } from "./botao-confirmar";
import { ariaCampo, Campo } from "./campo";

interface AlterarStatusProps {
  concursoId: number;
  atual: Status;
  transicoes: readonly Status[];
  desfazerPara: Status | null;
}

/** Troca de status restrita às transições permitidas + desfazer a última mudança. */
export function AlterarStatus({ concursoId, atual, transicoes, desfazerPara }: AlterarStatusProps) {
  const router = useRouter();
  const [para, setPara] = useState<Status | "">("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!para) return;
    setErro(null);
    iniciar(async () => {
      const r = await alterarStatus(concursoId, { para, observacao });
      if (r.ok) {
        setPara("");
        setObservacao("");
        router.refresh();
      } else {
        setErro(r.erros._form?.[0] ?? r.erros.para?.[0] ?? r.erros.observacao?.[0] ?? "Erro.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {transicoes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          “{ROTULO_STATUS[atual]}” é um status final: não há próximas etapas.
        </p>
      ) : (
        <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Campo
            id="novo-status"
            rotulo="Novo status"
            dica={para ? DESCRICAO_STATUS[para] : undefined}
          >
            <NativeSelect
              {...ariaCampo("novo-status", undefined, para ? "dica" : undefined)}
              className="w-full"
              value={para}
              onChange={(e) => setPara(e.target.value as Status | "")}
              required
            >
              <NativeSelectOption value="">Selecione…</NativeSelectOption>
              {transicoes.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {ROTULO_STATUS[s]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Campo>
          <Campo id="observacao-status" rotulo="Observação (opcional)">
            <Input
              id="observacao-status"
              value={observacao}
              maxLength={500}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: isenção deferida"
            />
          </Campo>
          <Button type="submit" disabled={!para || pendente}>
            {pendente ? "Salvando…" : "Alterar status"}
          </Button>
        </form>
      )}
      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
      {desfazerPara ? (
        <BotaoConfirmar
          titulo="Desfazer a última mudança?"
          descricao={
            <>
              O status volta de “{ROTULO_STATUS[atual]}” para “{ROTULO_STATUS[desfazerPara]}” e o
              último registro do histórico é removido.
            </>
          }
          rotuloConfirmar="Desfazer"
          variante="ghost"
          tamanho="sm"
          acao={() => desfazerUltimoStatus(concursoId)}
          aoConcluir={() => router.refresh()}
        >
          <Undo2 aria-hidden />
          Desfazer última mudança
        </BotaoConfirmar>
      ) : null}
    </div>
  );
}
