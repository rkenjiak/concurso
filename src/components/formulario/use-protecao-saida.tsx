"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { DialogoConfirmar } from "@/components/concurso/botao-confirmar";
import { destinoInterceptavel } from "@/lib/protecao-saida";

export interface ProtecaoSaida {
  /**
   * Sai do formulário (Cancelar, fechar o modal…): com alterações não salvas, pede confirmação
   * antes de chamar `prosseguir`; sem elas, chama na hora.
   */
  sair: (prosseguir: () => void) => void;
  /** Diálogo de confirmação: renderize junto do formulário. */
  dialogo: ReactNode;
}

/**
 * Alterações não salvas (#100, D10). Enquanto `ativa` (formulário sujo e sem envio em andamento —
 * depois de salvar, quem chama desativa):
 * - `beforeunload` (recarregar, fechar a aba, URL digitada) usa o aviso nativo do navegador;
 * - cliques em links internos (`<a>` da mesma origem, sem `target`/`download`/teclas
 *   modificadoras) são interceptados na captura, antes do `<Link>` do Next, e pedem confirmação;
 *   confirmando, a navegação segue pelo roteador;
 * - {@link ProtecaoSaida.sair} faz o mesmo para Cancelar e para fechar o modal.
 * Voltar do navegador (`popstate`) não é bloqueado (D10).
 */
export function useProtecaoSaida(ativa: boolean): ProtecaoSaida {
  const router = useRouter();
  const [pedido, setPedido] = useState<(() => void) | null>(null);
  /** Pedido aberto (para não trocá-lo por outro) e onde estava o foco ao abrir. */
  const pedidoAberto = useRef(false);
  const focoAntes = useRef<HTMLElement | null>(null);
  /** Saída confirmada, executada quando a confirmação terminar de fechar. */
  const saidaConfirmada = useRef<(() => void) | null>(null);
  const descartou = useRef(false);
  const pedir = useCallback((prosseguir: () => void) => {
    if (pedidoAberto.current) return;
    pedidoAberto.current = true;
    descartou.current = false;
    focoAntes.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPedido(() => prosseguir);
  }, []);
  /** Confirmada a saída, nada mais é bloqueado enquanto o formulário desmonta/navega. */
  const [liberada, setLiberada] = useState(false);
  const protegendo = ativa && !liberada;

  useEffect(() => {
    if (!protegendo) return;
    const antesDeSair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Navegadores antigos exigem `returnValue` para mostrar o aviso.
      e.returnValue = "";
    };
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target instanceof Element ? e.target.closest("a") : null;
      if (!alvo) return;
      const destino = destinoInterceptavel(
        e,
        {
          href: alvo.getAttribute("href"),
          target: alvo.getAttribute("target") ?? "",
          download: alvo.hasAttribute("download"),
        },
        window.location.href,
      );
      if (!destino) return;
      // Na captura do document: o `<Link>` (ouvinte do React na raiz) nem chega a ver o clique.
      e.preventDefault();
      e.stopPropagation();
      pedir(() => router.push(destino));
    };
    window.addEventListener("beforeunload", antesDeSair);
    document.addEventListener("click", aoClicar, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSair);
      document.removeEventListener("click", aoClicar, true);
    };
  }, [protegendo, router, pedir]);

  const protegendoRef = useRef(protegendo);
  useEffect(() => {
    protegendoRef.current = protegendo;
  }, [protegendo]);

  const sair = useCallback(
    (prosseguir: () => void) => {
      if (protegendoRef.current) pedir(prosseguir);
      else prosseguir();
    },
    [pedir],
  );

  const dialogo = (
    <DialogoConfirmar
      aberto={pedido !== null}
      aoMudarAberto={(aberto) => {
        if (aberto) return;
        setPedido(null);
        // Só depois do evento atual: o Esc que fecha a confirmação também chega ao modal de baixo
        // (o Radix nem sempre o ignora), e não pode reabri-la.
        setTimeout(() => {
          pedidoAberto.current = false;
        });
      }}
      // "Continuar editando" devolve o foco a quem o tinha (campo, link ou botão Cancelar).
      focoAoFechar={() =>
        !descartou.current && focoAntes.current?.isConnected ? focoAntes.current : null
      }
      // Descartando, a saída (fechar o modal, navegar) só acontece depois que a confirmação fecha:
      // se as duas camadas fechassem juntas, a devolução de foco desta venceria a do modal.
      aoFechado={() => {
        const saida = saidaConfirmada.current;
        saidaConfirmada.current = null;
        saida?.();
      }}
      titulo="Descartar alterações?"
      descricao="Há alterações que não foram salvas. Se sair agora, elas serão perdidas."
      rotuloConfirmar="Descartar e sair"
      rotuloCancelar="Continuar editando"
      destrutivo
      aoConcluir={() => {
        descartou.current = true;
        saidaConfirmada.current = pedido;
        setLiberada(true);
      }}
    />
  );

  return { sair, dialogo };
}
