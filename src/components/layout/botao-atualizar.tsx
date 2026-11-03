"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  CHAVE_ATUALIZAR,
  INTERVALO_ATUALIZAR_MS,
  lerUltimaAtualizacao,
  rotuloAtualizar,
  segundosRestantes,
} from "@/lib/atualizar";
import { cn } from "@/lib/utils";

/** Avisa os outros botões desta aba (celular e desktop ficam montados ao mesmo tempo). */
const EVENTO_ATUALIZAR = "concurso:atualizar";

/** Reserva se o `sessionStorage` não estiver disponível (modo privado restrito). */
let ultimaEmMemoria: string | null = null;

function lerValor(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_ATUALIZAR) ?? ultimaEmMemoria;
  } catch {
    return ultimaEmMemoria;
  }
}

function gravar(agora: number): void {
  ultimaEmMemoria = String(agora);
  try {
    sessionStorage.setItem(CHAVE_ATUALIZAR, ultimaEmMemoria);
  } catch {
    // Sem sessionStorage: o limite vale só enquanto a página não recarrega.
  }
  window.dispatchEvent(new Event(EVENTO_ATUALIZAR));
}

function assinar(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO_ATUALIZAR, aoMudar);
  return () => window.removeEventListener(EVENTO_ATUALIZAR, aoMudar);
}

/**
 * Botão "Atualizar" (#77): busca de novo os dados da tela com `router.refresh()`, mantendo aba,
 * scroll e diálogos abertos. Só manual (sem refresh automático, polling ou realtime) e no máximo
 * uma vez por minuto, contado no `sessionStorage` para valer em todas as páginas. Na espera, fica
 * com `aria-disabled` (continua focável) e o rótulo diz quanto falta.
 */
export function BotaoAtualizar({ className }: { className?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const ultima = lerUltimaAtualizacao(useSyncExternalStore(assinar, lerValor, () => null));
  const [agora, setAgora] = useState(() => Date.now());
  const [aviso, setAviso] = useState("");
  const atualizando = useRef(false);

  // Contagem regressiva: atualiza o relógio a cada segundo até liberar.
  useEffect(() => {
    if (ultima === null) return;
    setAgora(Date.now());
    const id = window.setInterval(() => {
      const t = Date.now();
      setAgora(t);
      if (t >= ultima + INTERVALO_ATUALIZAR_MS) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [ultima]);

  // Fim da atualização: avisa o leitor de tela.
  useEffect(() => {
    if (pendente || !atualizando.current) return;
    atualizando.current = false;
    setAviso("Dados atualizados");
  }, [pendente]);

  const restantes = segundosRestantes(ultima, agora);
  const bloqueado = restantes > 0 || pendente;
  const rotulo = pendente ? "Atualizando…" : rotuloAtualizar(restantes);

  function atualizar() {
    // Confere de novo na hora do clique: o estado da tela pode estar um segundo atrasado.
    const t = Date.now();
    if (pendente || segundosRestantes(lerUltimaAtualizacao(lerValor()), t) > 0) return;
    gravar(t);
    setAviso("");
    atualizando.current = true;
    iniciar(() => router.refresh());
  }

  return (
    <>
      <button
        type="button"
        onClick={atualizar}
        aria-disabled={bloqueado || undefined}
        aria-label={rotulo}
        title={rotulo}
        data-testid="botao-atualizar"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground pointer-coarse:size-10",
          className,
        )}
      >
        <RefreshCw
          className={cn("size-5", pendente && "animate-spin motion-reduce:animate-none")}
          aria-hidden
        />
      </button>
      <span aria-live="polite" className="sr-only">
        {aviso}
      </span>
    </>
  );
}
