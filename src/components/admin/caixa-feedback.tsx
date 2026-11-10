"use client";

import { Archive, Download, RotateCcw, Trash2, X } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { DialogoConfirmar } from "@/components/concurso/botao-confirmar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { quantidadeFeedbacks } from "@/domain/feedback";
import { ROTULO_STATUS_FEEDBACK, ROTULO_TIPO_FEEDBACK } from "@/domain/labels";
import type { FeedbackExportavel } from "@/lib/feedback-exportacao";
import { formatarDataHora } from "@/lib/format";
import type { FiltroStatusFeedback } from "@/lib/schemas/feedback";
import { alternarTodos, estadoTodos, marcarItem, somenteVisiveis } from "@/lib/selecao";
import { cn } from "@/lib/utils";
import {
  descartarFeedbacksAcao,
  desfazerDescarteAcao,
  excluirFeedbacksAcao,
  restaurarFeedbacksAcao,
} from "@/server/actions/feedback";
import { DialogoExportarFeedback, useAvisoFeedback } from "./dialogo-exportar-feedback";

interface CaixaFeedbackProps {
  itens: FeedbackExportavel[];
  /** Aba atual: em Descartados, as ações são restaurar e excluir. */
  status: FiltroStatusFeedback;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Mensagem truncada que expande ao clicar (botão com `aria-expanded`). */
function Mensagem({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={aberta}
      onClick={() => setAberta((v) => !v)}
      title={aberta ? "Recolher" : "Mostrar a mensagem inteira"}
      className={cn(
        "w-full max-w-md rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring",
        aberta ? "whitespace-pre-wrap break-words" : "line-clamp-2",
      )}
    >
      {texto}
    </button>
  );
}

/**
 * Caixa de entrada de feedback do admin (#117): tabela no estilo da auditoria com seleção em massa
 * (checkbox por linha; no cabeçalho, todos os visíveis, indeterminado quando parcial;
 * Shift+clique ou Shift+Espaço marcam o intervalo desde o último item) e, com seleção, uma barra
 * de ações fixa no rodapé. `Esc` limpa a seleção. A quantidade selecionada é anunciada.
 */
export function CaixaFeedback({ itens, status }: CaixaFeedbackProps) {
  const avisar = useAvisoFeedback();
  const [selecao, setSelecao] = useState<Set<number>>(new Set());
  const [exportando, setExportando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [pendente, iniciar] = useTransition();
  const ancora = useRef<number | null>(null);
  const shiftTeclado = useRef(false);
  const intervalo = useRef(false);
  // Só anuncia "Nenhum selecionado" depois de alguma seleção (não ao abrir a página).
  const houveSelecao = useRef(false);

  const ids = itens.map((i) => i.id);
  // Só conta o que ainda está na lista (após filtrar, paginar ou concluir uma ação).
  const selecionados = somenteVisiveis(selecao, ids);
  const quantidade = selecionados.size;
  if (quantidade > 0) houveSelecao.current = true;
  const descartados = status === "DESCARTADO";
  const itensSelecionados = itens.filter((i) => selecionados.has(i.id));
  // Descartados não são exportados (o servidor também os ignora): restaure-os antes.
  const exportaveis = itensSelecionados.filter((i) => i.status !== "DESCARTADO");
  const descartadosNaSelecao = itensSelecionados.length - exportaveis.length;

  const limpar = useCallback(() => {
    setSelecao(new Set());
    ancora.current = null;
  }, []);

  // Esc limpa a seleção (os diálogos tratam o próprio Esc).
  useEffect(() => {
    if (quantidade === 0 || exportando || excluindo) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      limpar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [quantidade, exportando, excluindo, limpar]);

  function descartar() {
    const lote = [...selecionados];
    iniciar(async () => {
      const r = await descartarFeedbacksAcao(lote);
      if (!r.ok) {
        avisar({ texto: r.erros._form?.[0] ?? "Não foi possível descartar.", tipo: "erro" });
        return;
      }
      limpar();
      const { anteriores, descartadoEm } = r.data;
      avisar({
        texto: `${plural(anteriores.length, "feedback descartado", "feedbacks descartados")}.`,
        acao:
          anteriores.length > 0 && descartadoEm !== null
            ? {
                rotulo: "Desfazer",
                executar: async () => {
                  const d = await desfazerDescarteAcao({ anteriores, descartadoEm });
                  avisar(
                    d.ok
                      ? { texto: "Descarte desfeito." }
                      : {
                          texto: d.erros._form?.[0] ?? "Não foi possível desfazer.",
                          tipo: "erro",
                        },
                  );
                },
              }
            : undefined,
      });
    });
  }

  function restaurar() {
    const lote = [...selecionados];
    iniciar(async () => {
      const r = await restaurarFeedbacksAcao(lote);
      if (!r.ok) {
        avisar({ texto: r.erros._form?.[0] ?? "Não foi possível restaurar.", tipo: "erro" });
        return;
      }
      limpar();
      avisar({
        texto: `${plural(r.data.restaurados, "feedback restaurado", "feedbacks restaurados")} para Novos.`,
      });
    });
  }

  function aoClicarCheckbox(e: MouseEvent) {
    intervalo.current = e.shiftKey || shiftTeclado.current;
    shiftTeclado.current = false;
  }

  function marcar(id: number, valor: boolean) {
    setSelecao((atual) =>
      marcarItem(
        somenteVisiveis(atual, ids),
        ids,
        id,
        valor,
        intervalo.current ? ancora.current : null,
      ),
    );
    intervalo.current = false;
    ancora.current = id;
  }

  if (itens.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhum feedback aqui.</p>;
  }

  const todos = estadoTodos(selecionados, ids);

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="sr-only">
        {quantidade > 0
          ? plural(quantidade, "selecionado", "selecionados")
          : houveSelecao.current
            ? "Nenhum selecionado"
            : ""}
      </p>
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground text-xs">
            <tr className="border-b">
              <th className="w-8 py-2 pr-3 font-medium">
                <Checkbox
                  aria-label="Selecionar todos os feedbacks visíveis"
                  checked={todos}
                  onCheckedChange={() => {
                    setSelecao((atual) => alternarTodos(somenteVisiveis(atual, ids), ids));
                    ancora.current = null;
                  }}
                />
              </th>
              <th className="py-2 pr-4 font-medium">Quando</th>
              <th className="py-2 pr-4 font-medium">Usuário</th>
              <th className="py-2 pr-4 font-medium">Tipo</th>
              <th className="py-2 pr-4 font-medium">Página</th>
              <th className="py-2 pr-4 font-medium">Mensagem</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((f) => {
              const quando = formatarDataHora(f.createdAt);
              const marcado = selecionados.has(f.id);
              return (
                <tr
                  key={f.id}
                  data-selecionado={marcado || undefined}
                  className="border-b align-top last:border-0 data-selecionado:bg-primary/5"
                >
                  <td className="py-2 pr-3">
                    <Checkbox
                      aria-label={`Selecionar feedback de ${f.usuario} em ${quando}`}
                      checked={marcado}
                      onKeyDown={(e) => {
                        if (e.key === " ") shiftTeclado.current = e.shiftKey;
                      }}
                      // Shift+clique não seleciona texto.
                      onMouseDown={(e) => {
                        if (e.shiftKey) e.preventDefault();
                      }}
                      onClick={aoClicarCheckbox}
                      onCheckedChange={(v) => marcar(f.id, v === true)}
                    />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 tabular-nums">{quando}</td>
                  <td className="max-w-48 truncate py-2 pr-4" title={f.usuario}>
                    {f.usuario}
                  </td>
                  <td className="py-2 pr-4">{ROTULO_TIPO_FEEDBACK[f.tipo]}</td>
                  <td className="py-2 pr-4">
                    {f.pagina ? <code className="text-xs">{f.pagina}</code> : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <Mensagem texto={f.mensagem} />
                  </td>
                  <td className="py-2">
                    <Badge variant={f.status === "NOVO" ? "default" : "secondary"}>
                      {ROTULO_STATUS_FEEDBACK[f.status]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {quantidade > 0 ? (
        // Barra fixa no rodapé enquanto houver seleção; no celular, acima da navegação inferior.
        <section
          aria-label="Ações da seleção"
          className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur md:bottom-4"
        >
          <p className="px-2 font-medium text-sm tabular-nums">
            {plural(quantidade, "selecionado", "selecionados")}
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            {descartados ? (
              <>
                <Button size="sm" variant="outline" onClick={restaurar} disabled={pendente}>
                  <RotateCcw aria-hidden />
                  Restaurar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setExcluindo(true)}
                  disabled={pendente}
                >
                  <Trash2 aria-hidden />
                  Excluir definitivamente
                </Button>
              </>
            ) : (
              <>
                {exportaveis.length === 0 ? (
                  <span className="self-center text-muted-foreground text-xs">
                    Descartados não são exportados: restaure-os antes.
                  </span>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => setExportando(true)}
                  disabled={pendente || exportaveis.length === 0}
                >
                  <Download aria-hidden />
                  Exportar
                </Button>
                <Button size="sm" variant="outline" onClick={descartar} disabled={pendente}>
                  <Archive aria-hidden />
                  Descartar
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={limpar} disabled={pendente}>
              <X aria-hidden />
              Limpar seleção
            </Button>
          </div>
        </section>
      ) : null}

      <DialogoExportarFeedback
        aberto={exportando}
        aoMudarAberto={setExportando}
        itens={exportaveis}
        descartadosIgnorados={descartadosNaSelecao}
        aoExportar={limpar}
      />
      <DialogoConfirmar
        aberto={excluindo}
        aoMudarAberto={setExcluindo}
        titulo={`Excluir ${quantidadeFeedbacks(quantidade)} definitivamente?`}
        descricao="Os feedbacks selecionados são apagados do banco. Não é possível desfazer."
        rotuloConfirmar="Excluir"
        destrutivo
        acao={async () => {
          const r = await excluirFeedbacksAcao([...selecionados]);
          if (r.ok) {
            avisar({
              texto: `${plural(r.data.excluidos, "feedback excluído", "feedbacks excluídos")}.`,
            });
            limpar();
          }
          return r;
        }}
      />
    </div>
  );
}
