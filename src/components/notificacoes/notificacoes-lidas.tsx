"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

interface ContextoLidas {
  /** Chaves abertas pelo clique desde a última renderização do layout no servidor. */
  lidas: ReadonlySet<string>;
  marcarLida: (chave: string) => void;
}

const VAZIO: ReadonlySet<string> = new Set();

const Contexto = createContext<ContextoLidas>({ lidas: VAZIO, marcarLida: () => {} });

/**
 * Notificações marcadas como lidas no cliente ao abrir o prazo pela central (#124). A action de
 * abrir sai junto com a navegação e não chama `refresh()` (senão o Next faria um refresh extra da
 * página de destino), então o layout não é re-renderizado e o contador viria velho. Aqui o
 * contador desconta as chaves abertas, e a lista as mostra como lidas (inclusive ao voltar pelo
 * histórico, que pode reaproveitar a página antiga).
 *
 * O desconto vale até o layout ser renderizado de novo no servidor: `versao` muda a cada
 * renderização dele (resposta de uma action com `refresh()`, botão Atualizar), e aí o contador e a
 * lista do servidor voltam a valer e o desconto é zerado. Comparar pela versão, e não pelo total,
 * corrige também o que o desconto não acerta: a action de abrir que falhou (sessão expirada, rede)
 * e mudanças que se anulam (abriu uma, outra virou elegível e o total ficou igual). O layout não é
 * re-renderizado ao navegar, então o desconto sobrevive à navegação para o prazo.
 */
export function NotificacoesLidasProvider({
  versao,
  children,
}: {
  /** Muda a cada renderização do layout no servidor; ausente na visão admin (sem contador). */
  versao: string | undefined;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState({ versao, lidas: VAZIO });
  // Layout novo do servidor: zera o desconto já nesta renderização (estado derivado das props).
  if (estado.versao !== versao) setEstado({ versao, lidas: VAZIO });
  const lidas = estado.versao === versao ? estado.lidas : VAZIO;

  const marcarLida = useCallback((chave: string) => {
    setEstado((atual) =>
      atual.lidas.has(chave) ? atual : { ...atual, lidas: new Set(atual.lidas).add(chave) },
    );
  }, []);
  const valor = useMemo(() => ({ lidas, marcarLida }), [lidas, marcarLida]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Chaves abertas no cliente e a função para marcar mais uma. */
export function useNotificacoesLidas(): ContextoLidas {
  return useContext(Contexto);
}

/** Contador de não lidas do servidor, descontadas as abertas no cliente. */
export function useNaoLidas(doServidor: number): number {
  const { lidas } = useContext(Contexto);
  return Math.max(0, doServidor - lidas.size);
}
