"use client";

import { Copy, ExternalLink, Link2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { caminhoCompartilhado, urlCompartilhada } from "@/lib/compartilhamento";
import {
  gerarCompartilhamentoAcao,
  regenerarCompartilhamentoAcao,
  revogarCompartilhamentoAcao,
} from "@/server/actions/compartilhamento";

interface DialogoCompartilharConcursoProps {
  concursoId: number;
  nome: string;
  token: string | null;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  focoAoFechar?: () => HTMLElement | null;
}

/**
 * Diálogo de compartilhamento público do concurso (#129), controlado a partir do menu "⋯":
 * informa o que fica visível vs. privado, permite ativar, copiar link, gerar novo link e revogar.
 */
export function DialogoCompartilharConcurso({
  concursoId,
  nome,
  token,
  aberto,
  aoMudarAberto,
  focoAoFechar,
}: DialogoCompartilharConcursoProps) {
  const idUrl = useId();
  const { avisar } = useAvisos();
  const [tokenAtual, setTokenAtual] = useState<string | null>(token);
  const [origem, setOrigem] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState<"regenerar" | "revogar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    setOrigem(window.location.origin);
  }, []);

  useEffect(() => {
    setTokenAtual(token);
    setCopiado(false);
    setConfirmando(null);
  }, [token]);

  const url = tokenAtual && origem ? urlCompartilhada(origem, tokenAtual) : "";

  function ativar() {
    setErro(null);
    setConfirmando(null);
    iniciar(async () => {
      const r = await gerarCompartilhamentoAcao(concursoId);
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível ativar o compartilhamento.");
        return;
      }
      setTokenAtual(r.data.token);
      setCopiado(false);
      avisar({ texto: "Link público ativado.", chave: `compartilhar-${concursoId}` });
    });
  }

  function regenerar() {
    setErro(null);
    iniciar(async () => {
      const r = await regenerarCompartilhamentoAcao(concursoId);
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível gerar um novo link.");
        return;
      }
      setTokenAtual(r.data.token);
      setCopiado(false);
      setConfirmando(null);
      avisar({
        texto: "Novo link gerado. O anterior deixou de funcionar.",
        chave: `compartilhar-${concursoId}`,
      });
    });
  }

  function revogar() {
    setErro(null);
    iniciar(async () => {
      const r = await revogarCompartilhamentoAcao(concursoId);
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível revogar o compartilhamento.");
        return;
      }
      setTokenAtual(null);
      setCopiado(false);
      setConfirmando(null);
      avisar({ texto: "Acesso público revogado.", chave: `compartilhar-${concursoId}` });
    });
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setErro(null);
      avisar({ texto: "Link público copiado.", chave: `compartilhar-copia-${concursoId}` });
    } catch {
      setErro("Não foi possível copiar automaticamente. Copie o link do campo acima.");
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        aoMudarAberto(v);
        if (!v) {
          setErro(null);
          setCopiado(false);
          setConfirmando(null);
        }
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        onCloseAutoFocus={(e) => {
          const alvo = focoAoFechar?.();
          if (!alvo) return;
          e.preventDefault();
          alvo.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Compartilhar cronograma</DialogTitle>
          <DialogDescription>
            Link público somente leitura para <strong>{nome}</strong>, sem exigir login. Alterações
            no concurso passam a aparecer após alguns minutos (a página é revalidada a cada 5
            minutos quando acessada).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-xs">
          <div className="space-y-1">
            <p className="font-medium text-foreground">O que fica visível no link:</p>
            <p className="text-muted-foreground">
              Cor e ícone do concurso, órgão, cargo, banca, esfera, cidade/UF, status atual (com
              data), cronograma de eventos (datas, horas e concluídos), homologação e validade
              (meses, prorrogação e data final) e histórico de transições de status.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">O que continua privado:</p>
            <p className="text-muted-foreground">
              Observações (do concurso, de eventos e do histórico), local dos eventos, links, notas
              e resultados, remuneração, vagas, tags e dados da sua conta.
            </p>
          </div>
        </div>

        {tokenAtual ? (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor={idUrl}>Link público</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id={idUrl}
                  value={url}
                  readOnly
                  className="min-w-0 flex-1 font-mono text-xs"
                  data-testid="url-compartilhamento"
                />
                <Button type="button" variant="outline" onClick={copiar} disabled={!url}>
                  <Copy aria-hidden />
                  {copiado ? "Copiado" : "Copiar link"}
                </Button>
                <Button asChild variant="outline">
                  <a
                    href={caminhoCompartilhado(tokenAtual)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink aria-hidden />
                    Abrir
                    <span className="sr-only"> página pública (abre em nova aba)</span>
                  </a>
                </Button>
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-muted-foreground text-xs">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Gerar um novo link substitui e invalida o endereço anterior imediatamente.
              </span>
            </p>
            {confirmando ? (
              <div
                role="alert"
                className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
              >
                <p className="text-foreground">
                  {confirmando === "regenerar"
                    ? "O link atual deixará de funcionar imediatamente para quem já o recebeu."
                    : "Quem tiver este link deixará de ver o cronograma imediatamente."}
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmando(null)}
                    disabled={pendente}
                  >
                    Voltar
                  </Button>
                  {confirmando === "regenerar" ? (
                    <Button type="button" size="sm" onClick={regenerar} disabled={pendente}>
                      <RefreshCw aria-hidden />
                      {pendente ? "Gerando…" : "Confirmar novo link"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={revogar}
                      disabled={pendente}
                    >
                      <Trash2 aria-hidden />
                      {pendente ? "Revogando…" : "Confirmar revogação"}
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Nenhum link ativo para este concurso. Ative para gerar um endereço compartilhável.
          </p>
        )}

        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {tokenAtual ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setErro(null);
                    setConfirmando("regenerar");
                  }}
                  disabled={pendente}
                >
                  <RefreshCw aria-hidden />
                  Gerar novo link
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setErro(null);
                    setConfirmando("revogar");
                  }}
                  disabled={pendente}
                >
                  <Trash2 aria-hidden />
                  Revogar acesso
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => aoMudarAberto(false)}
                disabled={pendente}
              >
                Fechar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => aoMudarAberto(false)}
                disabled={pendente}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={ativar} disabled={pendente}>
                <Link2 aria-hidden />
                {pendente ? "Ativando…" : "Ativar compartilhamento"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
