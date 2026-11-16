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
 * Quando o servidor manda outro `naoLidas` (resposta de uma action com `refresh()`, botão
 * Atualizar), o valor do servidor volta a valer e o desconto é zerado.
 */
export function NotificacoesLidasProvider({
  naoLidas,
  children,
}: {
  naoLidas: number | undefined;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState({ base: naoLidas, lidas: VAZIO });
  // Valor novo do servidor: zera o desconto já nesta renderização (estado derivado das props).
  if (estado.base !== naoLidas) setEstado({ base: naoLidas, lidas: VAZIO });
  const lidas = estado.base === naoLidas ? estado.lidas : VAZIO;

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
