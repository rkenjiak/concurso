"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { sincronizarCorTema } from "@/lib/pwa";
import {
  aplicarTema,
  CHAVE_TEMA,
  CONSULTA_ESCURO,
  normalizarTema,
  ROTULO_TEMA,
  resolverTema,
  TEMA_PADRAO,
  TEMAS,
  type Tema,
} from "@/lib/tema";
import { cn } from "@/lib/utils";

const ICONE_TEMA = { claro: Sun, escuro: Moon, sistema: Monitor } as const;

/** Avisa os seletores desta aba (o evento `storage` só dispara nas outras abas). */
const EVENTO_TEMA = "concurso:tema";

function lerTema(): Tema {
  try {
    return normalizarTema(localStorage.getItem(CHAVE_TEMA));
  } catch {
    return TEMA_PADRAO;
  }
}

function assinar(aoMudar: () => void): () => void {
  window.addEventListener("storage", aoMudar);
  window.addEventListener(EVENTO_TEMA, aoMudar);
  return () => {
    window.removeEventListener("storage", aoMudar);
    window.removeEventListener(EVENTO_TEMA, aoMudar);
  };
}

function aplicar(tema: Tema): void {
  const efetivo = resolverTema(tema, matchMedia(CONSULTA_ESCURO).matches);
  aplicarTema(document.documentElement, efetivo);
  sincronizarCorTema(document, efetivo === "escuro");
}

/** Alternância Claro / Escuro / Sistema, persistida no `localStorage`. */
export function SeletorTema({ className }: { className?: string }) {
  const tema = useSyncExternalStore(assinar, lerTema, () => TEMA_PADRAO);

  // Reaplica antes da pintura (o remount do Strict Mode em dev limpa a classe do <html>).
  useLayoutEffect(() => aplicar(tema), [tema]);

  // No modo "sistema", acompanha mudanças do sistema operacional em tempo real.
  useEffect(() => {
    if (tema !== "sistema") return;
    const consulta = matchMedia(CONSULTA_ESCURO);
    const aoMudar = () => aplicar("sistema");
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, [tema]);

  const escolher = useCallback((novo: Tema) => {
    try {
      localStorage.setItem(CHAVE_TEMA, novo);
    } catch {
      // Sem localStorage (modo privado restrito): aplica só nesta página.
    }
    aplicar(novo);
    window.dispatchEvent(new Event(EVENTO_TEMA));
  }, []);

  return (
    <fieldset
      aria-label="Tema"
      className={cn(
        "m-0 inline-flex min-w-0 items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5",
        className,
      )}
    >
      {TEMAS.map((opcao) => {
        const Icone = ICONE_TEMA[opcao];
        const ativo = opcao === tema;
        return (
          <button
            key={opcao}
            type="button"
            aria-pressed={ativo}
            aria-label={ROTULO_TEMA[opcao]}
            title={ROTULO_TEMA[opcao]}
            onClick={() => escolher(opcao)}
            className={cn(
              "inline-flex size-7 pointer-coarse:size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              ativo && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icone className="size-4" aria-hidden />
          </button>
        );
      })}
    </fieldset>
  );
}
