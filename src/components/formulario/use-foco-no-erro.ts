"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Foco no erro (#100, item 15): depois de uma validação que falhou (no cliente ou no servidor),
 * leva o foco ao primeiro campo inválido (`aria-invalid="true"`, na ordem do documento) ou, sem
 * erro de campo, ao erro geral (`_form`, com `tabIndex={-1}`).
 *
 * Os erros de campo do react-hook-form podem chegar ao DOM numa renderização posterior à do
 * pedido (o `handleSubmit` publica os erros depois do `onInvalid`): o pedido fica pendente e é
 * atendido na primeira renderização em que o campo inválido existir.
 *
 * Uso: `ref={formRef}` no `<form>`, `ref={erroGeralRef}` no parágrafo do erro geral e
 * `focarErro(temErroDeCampo)` no `onInvalid` do `handleSubmit` e após uma resposta de erro do
 * servidor (com `shouldFocusError: false` no `useForm`, para não haver dois focos).
 */
export function useFocoNoErro() {
  const formRef = useRef<HTMLFormElement>(null);
  const erroGeralRef = useRef<HTMLParagraphElement>(null);
  /** `null` = nada pendente; `true` = esperar o campo inválido; `false` = erro geral. */
  const pendente = useRef<boolean | null>(null);

  const atender = useCallback(() => {
    if (pendente.current === null) return;
    const campo = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const alvo = campo ?? (pendente.current ? null : erroGeralRef.current);
    if (!alvo) return;
    pendente.current = null;
    alvo.focus();
  }, []);

  // Sem dependências: confere a cada renderização enquanto houver pedido pendente.
  useEffect(() => {
    atender();
  });

  /** Pede o foco; `temErroDeCampo` = esperar por um campo inválido antes de cair no erro geral. */
  const focarErro = useCallback(
    (temErroDeCampo: boolean) => {
      pendente.current = temErroDeCampo;
      // Se o DOM já estiver pronto (nenhuma renderização a caminho), atende na hora.
      queueMicrotask(atender);
    },
    [atender],
  );

  return { formRef, erroGeralRef, focarErro };
}
