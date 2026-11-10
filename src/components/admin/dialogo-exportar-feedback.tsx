"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { type NovoAviso, useAvisos } from "@/components/avisos/avisos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { quantidadeFeedbacks } from "@/domain/feedback";
import {
  exportarFeedbacksComo,
  type FeedbackExportavel,
  nomeArquivoFeedbacks,
} from "@/lib/feedback-exportacao";
import type { FormatoExportacaoFeedback } from "@/lib/schemas/feedback";
import { cn } from "@/lib/utils";
import { exportarFeedbacksAcao } from "@/server/actions/feedback";

/**
 * Avisos da caixa de entrada com a mesma chave: cada ação substitui o aviso da anterior em vez de
 * empilhar (a pilha mostra no máximo 3).
 */
export const CHAVE_AVISO_FEEDBACK = "feedback-caixa";

/** `avisar` com a chave da caixa de entrada. */
export function useAvisoFeedback() {
  const { avisar } = useAvisos();
  return (aviso: NovoAviso) => avisar({ chave: CHAVE_AVISO_FEEDBACK, ...aviso });
}

const FORMATOS: { valor: FormatoExportacaoFeedback; rotulo: string; descricao: string }[] = [
  {
    valor: "MARKDOWN_ISSUES",
    rotulo: "Markdown: uma issue por feedback",
    descricao: "Um bloco com título sugerido e corpo para cada feedback.",
  },
  {
    valor: "MARKDOWN_AGRUPADO",
    rotulo: "Markdown: uma issue agrupando todos",
    descricao: "Para vários feedbacks sobre o mesmo assunto: cada mensagem citada.",
  },
  {
    valor: "JSON",
    rotulo: "Baixar JSON",
    descricao: "Array com os campos, para scripts.",
  },
  {
    valor: "GH",
    rotulo: "Comandos gh",
    descricao: "Um gh issue create por feedback, para colar num terminal bash ou zsh.",
  },
];

interface DialogoExportarFeedbackProps {
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  /** Feedbacks selecionados, na ordem da lista. */
  itens: FeedbackExportavel[];
  /** Chamado depois de exportar (limpa a seleção). */
  aoExportar: () => void;
}

function baixar(conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoFeedbacks(new Date());
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exportar feedbacks (#117): escolhe o formato, mostra a prévia e, ao confirmar, copia (ou baixa
 * o JSON) e marca os itens como exportados. Sem o e-mail do usuário por padrão: as issues são
 * públicas. A cópia acontece no próprio clique (o navegador exige o gesto do usuário); o
 * conteúdo usa a mesma formatação do servidor.
 */
export function DialogoExportarFeedback({
  aberto,
  aoMudarAberto,
  itens,
  aoExportar,
}: DialogoExportarFeedbackProps) {
  const avisar = useAvisoFeedback();
  const id = useId();
  const [formato, setFormato] = useState<FormatoExportacaoFeedback>("MARKDOWN_ISSUES");
  const [incluirEmail, setIncluirEmail] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const previa = useMemo(
    () => exportarFeedbacksComo(formato, itens, { incluirEmail }),
    [formato, itens, incluirEmail],
  );
  const ehJson = formato === "JSON";

  function exportar() {
    setErro(null);
    // Chamado ainda dentro do clique: o navegador só permite copiar com o gesto do usuário.
    const copia = ehJson ? Promise.resolve() : navigator.clipboard.writeText(previa);
    iniciar(async () => {
      try {
        await copia;
      } catch {
        setErro("Não foi possível copiar. Selecione o texto da prévia e copie manualmente.");
        return;
      }
      const r = await exportarFeedbacksAcao(
        itens.map((i) => i.id),
        formato,
        incluirEmail,
      );
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível exportar.");
        return;
      }
      if (ehJson) baixar(r.data.conteudo);
      avisar({
        texto: `${quantidadeFeedbacks(r.data.exportados)} ${
          r.data.exportados === 1 ? "exportado" : "exportados"
        }${ehJson ? "." : ": conteúdo copiado."}`,
      });
      aoMudarAberto(false);
      aoExportar();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !pendente && aoMudarAberto(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar {quantidadeFeedbacks(itens.length)}</DialogTitle>
          <DialogDescription>
            Para virar issue no GitHub. Ao confirmar, os itens passam a <strong>Exportado</strong>.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-2">
          <legend className="mb-2 font-medium text-sm">Formato</legend>
          {FORMATOS.map((f) => (
            <label
              key={f.valor}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                formato === f.valor ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name={`${id}-formato`}
                value={f.valor}
                checked={formato === f.valor}
                onChange={() => setFormato(f.valor)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="block font-medium">{f.rotulo}</span>
                <span className="block text-muted-foreground text-xs">{f.descricao}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-email`}
            checked={incluirEmail}
            onCheckedChange={(v) => setIncluirEmail(v === true)}
          />
          <Label htmlFor={`${id}-email`}>Incluir e-mail do usuário (as issues são públicas)</Label>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-previa`}>Prévia</Label>
          <textarea
            id={`${id}-previa`}
            readOnly
            value={previa}
            rows={10}
            className="max-h-[35dvh] w-full rounded-lg border bg-muted/40 p-2 font-mono text-xs"
          />
        </div>
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => aoMudarAberto(false)}
            disabled={pendente}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={exportar} disabled={pendente || itens.length === 0}>
            {pendente
              ? "Exportando…"
              : ehJson
                ? "Baixar e marcar como exportados"
                : "Copiar e marcar como exportados"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
