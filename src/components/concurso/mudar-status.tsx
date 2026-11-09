"use client";

import { ArrowRightLeft, Undo2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Status } from "@/domain/enums";
import { DESCRICAO_STATUS, ROTULO_STATUS } from "@/domain/labels";
import { MUDAR_STATUS, PARAM_MUDAR, urlSemParametro } from "@/lib/aba-concurso";
import { alterarStatus, desfazerUltimoStatus } from "@/server/actions/status";
import { BotaoConfirmar } from "./botao-confirmar";
import { ariaCampo, Campo } from "./campo";
import { useDesfazerStatus } from "./use-desfazer-status";

interface MudarStatusProps {
  concursoId: number;
  atual: Status;
  transicoes: readonly Status[];
  desfazerPara: Status | null;
}

/**
 * Botão "Mudar status" ao lado do badge no cabeçalho do concurso (#100, D7): abre uma gaveta
 * (celular) ou diálogo (desktop) com as transições permitidas, observação opcional e "Desfazer
 * última mudança". O resultado é anunciado por aviso com "Desfazer". `?mudar=status` abre o
 * diálogo ao carregar (link da edição do concurso). Sem transições nem o que desfazer, não aparece.
 */
export function MudarStatus({ concursoId, atual, transicoes, desfazerPara }: MudarStatusProps) {
  const { avisar } = useAvisos();
  const params = useSearchParams();
  const [aberto, setAberto] = useState(() => params.get(PARAM_MUDAR) === MUDAR_STATUS);
  const [para, setPara] = useState<Status | "">("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const desfazer = useDesfazerStatus(iniciar);
  const chave = `status-${concursoId}`;

  const semAcoes = transicoes.length === 0 && !desfazerPara;

  // Sem controle para abrir, `?mudar=status` (link da edição) não pode ficar preso na URL.
  useEffect(() => {
    if (!semAcoes) return;
    if (new URL(window.location.href).searchParams.has(PARAM_MUDAR)) {
      window.history.replaceState(null, "", urlSemParametro(window.location.href, PARAM_MUDAR));
    }
  }, [semAcoes]);

  if (semAcoes) return null;

  function mudarAberto(v: boolean) {
    setAberto(v);
    if (v) return;
    setPara("");
    setObservacao("");
    setErro(null);
    if (new URL(window.location.href).searchParams.has(PARAM_MUDAR)) {
      window.history.replaceState(null, "", urlSemParametro(window.location.href, PARAM_MUDAR));
    }
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!para) return;
    setErro(null);
    iniciar(async () => {
      const r = await alterarStatus(concursoId, { para, observacao });
      if (r.ok) {
        mudarAberto(false);
        avisar({
          texto: `Status → “${ROTULO_STATUS[para]}”.`,
          chave,
          acao: { rotulo: "Desfazer", executar: () => desfazer(concursoId, r.data.registroId) },
        });
      } else {
        setErro(r.erros._form?.[0] ?? r.erros.para?.[0] ?? r.erros.observacao?.[0] ?? "Erro.");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="max-md:h-11 max-md:px-3">
          <ArrowRightLeft aria-hidden />
          Mudar status
        </Button>
      </DialogTrigger>
      <DialogContent
        variante="gaveta"
        onInteractOutside={(e) => {
          // Clicar num aviso (ex.: "Desfazer") não fecha o diálogo.
          if ((e.target as Element | null)?.closest?.("[data-avisos]")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Mudar status</DialogTitle>
          <DialogDescription>
            Atual: “{ROTULO_STATUS[atual]}”. A mudança fica registrada no histórico.
          </DialogDescription>
        </DialogHeader>
        {transicoes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            “{ROTULO_STATUS[atual]}” é um status final: não há próximas etapas.
          </p>
        ) : (
          <form id="form-mudar-status" onSubmit={salvar} className="grid gap-3">
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
          </form>
        )}
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}
        <DialogFooter className="sm:justify-between">
          {desfazerPara ? (
            <BotaoConfirmar
              titulo="Desfazer a última mudança?"
              descricao={
                <>
                  O status volta de “{ROTULO_STATUS[atual]}” para “{ROTULO_STATUS[desfazerPara]}” e
                  o último registro do histórico é removido.
                </>
              }
              rotuloConfirmar="Desfazer"
              variante="ghost"
              tamanho="lg"
              // O usuário vê "Atual: …": se mudou desde então, o servidor recusa.
              acao={() => desfazerUltimoStatus(concursoId, { status: atual })}
              aoConcluir={() => {
                mudarAberto(false);
                avisar({
                  texto: `Mudança desfeita: de volta a “${ROTULO_STATUS[desfazerPara]}”.`,
                  tipo: "info",
                  chave,
                });
              }}
            >
              <Undo2 aria-hidden />
              Desfazer última mudança
            </BotaoConfirmar>
          ) : (
            <span aria-hidden className="max-sm:hidden" />
          )}
          {transicoes.length > 0 ? (
            <Button
              type="submit"
              form="form-mudar-status"
              disabled={!para || pendente}
              className="max-md:h-11"
            >
              {pendente ? "Salvando…" : "Alterar status"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
