"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
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
  /** Feedbacks selecionados que podem ser exportados (sem os descartados), na ordem da lista. */
  itens: FeedbackExportavel[];
  /** Descartados na seleção, deixados de fora (restaure-os antes). */
  descartadosIgnorados?: number;
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
 * Copia para a área de transferência o conteúdo que a promessa entregar, ainda dentro do gesto do
 * clique (`ClipboardItem` com promessa: o navegador guarda a permissão do gesto e espera o
 * servidor). Sem a API, devolve `null` e quem chama mostra o conteúdo para copiar à mão.
 */
function copiarQuandoPronto(conteudo: Promise<string>): Promise<void> | null {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return null;
    const blob = conteudo.then((texto) => new Blob([texto], { type: "text/plain" }));
    return navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
  } catch {
    return null;
  }
}

const plural = (n: number) => (n === 1 ? "exportado" : "exportados");

/**
 * Exportar feedbacks (#117): escolhe o formato, mostra a prévia e, ao confirmar, marca os itens
 * como exportados no servidor e copia (ou baixa, no JSON) **o conteúdo que o servidor gerou** para
 * os itens que de fato mudaram: a contagem do aviso, a auditoria e o que foi copiado batem. Sem o
 * e-mail do usuário por padrão (as issues são públicas); a opção volta a desmarcada sempre que o
 * diálogo fecha. Sem a API de área de transferência (ou se a cópia falhar), o conteúdo aparece no
 * diálogo com um botão "Copiar".
 */
export function DialogoExportarFeedback({
  aberto,
  aoMudarAberto,
  itens,
  descartadosIgnorados = 0,
  aoExportar,
}: DialogoExportarFeedbackProps) {
  const avisar = useAvisoFeedback();
  const id = useId();
  const [formato, setFormato] = useState<FormatoExportacaoFeedback>("MARKDOWN_ISSUES");
  const [incluirEmail, setIncluirEmail] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Exportado, mas não copiado: o conteúdo do servidor para copiar à mão. */
  const [manual, setManual] = useState<{ conteudo: string; exportados: number } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();
  const areaManual = useRef<HTMLTextAreaElement>(null);
  const previa = useMemo(
    () => exportarFeedbacksComo(formato, itens, { incluirEmail }),
    [formato, itens, incluirEmail],
  );
  const ehJson = formato === "JSON";

  /** Todo fechamento (Cancelar, sucesso, Esc, clique fora) volta às opções seguras. */
  function mudarAberto(v: boolean) {
    if (!v) {
      setIncluirEmail(false);
      setErro(null);
      setManual(null);
      setCopiado(false);
    }
    aoMudarAberto(v);
  }

  function exportar() {
    setErro(null);
    const ids = itens.map((i) => i.id);
    const comoJson = ehJson;
    // O callback roda na hora, ainda dentro do clique: a ação começa e a cópia é pedida já com o
    // gesto do usuário, esperando o conteúdo do servidor.
    iniciar(async () => {
      const acao = exportarFeedbacksAcao(ids, formato, incluirEmail);
      const copia = comoJson
        ? null
        : copiarQuandoPronto(
            acao.then((r) => {
              if (!r.ok) throw new Error("exportação recusada");
              return r.data.conteudo;
            }),
          );
      copia?.catch(() => {});
      const r = await acao;
      if (!r.ok) {
        const motivo = r.erros._form?.[0] ?? "Não foi possível exportar.";
        setErro(`${motivo} Nada foi copiado e os itens não foram marcados como exportados.`);
        return;
      }
      const { conteudo, exportados } = r.data;
      aoExportar();
      if (comoJson) {
        baixar(conteudo);
        avisar({ texto: `${quantidadeFeedbacks(exportados)} ${plural(exportados)}.` });
        mudarAberto(false);
        return;
      }
      let copiou = false;
      if (copia) {
        try {
          await copia;
          copiou = true;
        } catch {}
      }
      if (copiou) {
        avisar({
          texto: `${quantidadeFeedbacks(exportados)} ${plural(exportados)}: conteúdo copiado.`,
        });
        mudarAberto(false);
        return;
      }
      setManual({ conteudo, exportados });
    });
  }

  async function copiarManual() {
    if (!manual) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("sem api");
      await navigator.clipboard.writeText(manual.conteudo);
      setCopiado(true);
      setErro(null);
    } catch {
      areaManual.current?.select();
      setErro("Não foi possível copiar. O texto está selecionado: copie com Ctrl+C (⌘C no Mac).");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !pendente && mudarAberto(v)}>
      <DialogContent className="sm:max-w-2xl">
        {manual ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {quantidadeFeedbacks(manual.exportados)} {plural(manual.exportados)}
              </DialogTitle>
              <DialogDescription>
                Os itens já foram marcados como exportados, mas o conteúdo não foi copiado
                automaticamente. Copie abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-manual`}>Conteúdo exportado</Label>
              <textarea
                ref={areaManual}
                id={`${id}-manual`}
                readOnly
                value={manual.conteudo}
                rows={12}
                className="max-h-[45dvh] w-full rounded-lg border bg-muted/40 p-2 font-mono text-xs"
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Exportar {quantidadeFeedbacks(itens.length)}</DialogTitle>
              <DialogDescription>
                Para virar issue no GitHub. Ao confirmar, os itens passam a{" "}
                <strong>Exportado</strong>.
                {descartadosIgnorados > 0
                  ? ` ${quantidadeFeedbacks(descartadosIgnorados)} ${
                      descartadosIgnorados === 1 ? "descartado fica" : "descartados ficam"
                    } de fora (restaure antes de exportar).`
                  : null}
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
              <Label htmlFor={`${id}-email`}>
                Incluir e-mail do usuário (as issues são públicas)
              </Label>
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
          </>
        )}
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}
        <DialogFooter>
          {manual ? (
            <>
              <Button type="button" variant="outline" onClick={() => mudarAberto(false)}>
                Fechar
              </Button>
              <Button type="button" onClick={copiarManual}>
                {copiado ? "Copiado" : "Copiar"}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => mudarAberto(false)}
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
