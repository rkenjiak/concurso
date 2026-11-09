/**
 * Textos do contador de notificações não lidas, compartilhados pelos pontos de entrada da central:
 * o sino da barra lateral (desktop) e o item Notificações da barra inferior (celular, #105).
 */

/** Texto do selo: até 99, depois "99+". */
export function textoContadorNotificacoes(naoLidas: number): string {
  return naoLidas > 99 ? "99+" : String(naoLidas);
}

/**
 * Nome acessível do ponto de entrada: com não lidas, traz o número real (o selo pode mostrar
 * "99+"); sem nenhuma, diz "nenhuma não lida".
 */
export function rotuloNotificacoes(naoLidas: number): string {
  if (naoLidas === 0) return "Notificações (nenhuma não lida)";
  return `Notificações (${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"})`;
}

/** Selo vermelho do contador (posicionado pelo pai, que deve ser `relative`). */
export const CLASSE_SELO_NOTIFICACOES =
  "absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-[0.625rem] text-white tabular-nums leading-none";
