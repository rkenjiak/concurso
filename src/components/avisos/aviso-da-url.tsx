"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { urlSemParametro } from "@/lib/aba-concurso";
import { PARAM_AVISO, textoAvisoUrl } from "@/lib/aviso-url";
import { useAvisos } from "./avisos";

/**
 * Mostra o aviso pedido por `?aviso=` (ação que terminou com redirect, ex.: salvar ou excluir um
 * concurso, #100) e tira o parâmetro da URL com `history.replaceState` — sem nova requisição; o
 * aviso não se repete ao recarregar nem fica no histórico. Valor desconhecido só é removido.
 */
export function AvisoDaUrl() {
  const valor = useSearchParams().get(PARAM_AVISO);
  const { avisar } = useAvisos();

  useEffect(() => {
    if (valor === null) return;
    const texto = textoAvisoUrl(valor);
    // Com chave: se o efeito rodar de novo com o mesmo valor, o aviso é substituído, não repetido.
    if (texto) avisar({ texto, chave: `${PARAM_AVISO}-${valor}` });
    window.history.replaceState(null, "", urlSemParametro(window.location.href, PARAM_AVISO));
  }, [valor, avisar]);

  return null;
}
