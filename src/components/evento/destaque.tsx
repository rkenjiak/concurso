"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Duração do destaque forte do alvo de um deep-link (#100, D2). */
export const DURACAO_DESTAQUE_MS = 5000;

const reduzirMovimento = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Leva o usuário ao alvo de um deep-link (#100, D2): rola até ele (sem animação se o sistema pede
 * menos movimento), dá foco programático e mantém o destaque forte por ~5 s. Refaz a cada novo
 * alvo (`chave`); `null` = sem alvo.
 */
export function useDestaqueAlvo<T extends HTMLElement>(chave: string | number | null) {
  const ref = useRef<T>(null);
  const [forte, setForte] = useState(false);

  useEffect(() => {
    if (chave === null) return;
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: reduzirMovimento() ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    setForte(true);
    const t = window.setTimeout(() => setForte(false), DURACAO_DESTAQUE_MS);
    return () => window.clearTimeout(t);
  }, [chave]);

  return { ref, forte: chave !== null && forte };
}

/**
 * Classes do alvo: destaque forte (contorno espesso + fundo) e, depois, contorno sutil enquanto o
 * parâmetro existir. A espessura do contorno muda, não só a cor. O contorno (e não borda/sombra)
 * fica por cima do conteúdo e não altera o layout.
 */
export function classesDestaque(alvo: boolean, forte: boolean): string {
  if (!alvo) return "";
  return cn(
    "scroll-m-4 outline-primary motion-safe:transition-[outline-width,background-color] motion-safe:duration-500",
    forte ? "bg-primary/10 outline-3 -outline-offset-3" : "outline-1 -outline-offset-1",
  );
}

/**
 * Bloco destacável (ex.: card Validade, `?foco=validade`): recebe o foco programático e o
 * destaque quando `alvo`.
 */
export function BlocoDestacavel({
  alvo,
  className,
  ...props
}: ComponentProps<"div"> & { alvo: boolean }) {
  const { ref, forte } = useDestaqueAlvo<HTMLDivElement>(alvo ? "alvo" : null);
  return (
    <div
      {...props}
      ref={ref}
      tabIndex={alvo ? -1 : undefined}
      aria-current={alvo ? "true" : undefined}
      data-destaque={alvo ? (forte ? "forte" : "sutil") : undefined}
      className={cn(classesDestaque(alvo, forte), alvo && "rounded-xl", className)}
    />
  );
}
