/**
 * Preferência de tema (claro, escuro ou do sistema), persistida no `localStorage`.
 *
 * O tema efetivo é aplicado como a classe `dark` no `<html>` (ver `globals.css`). Um script
 * inline no `<head>` ({@link SCRIPT_TEMA}) aplica a preferência antes da primeira pintura,
 * evitando o flash de tema errado no carregamento.
 */

import { COR_TEMA, SELETOR_META_COR } from "./pwa";

export const TEMAS = ["claro", "escuro", "sistema"] as const;
export type Tema = (typeof TEMAS)[number];
export type TemaEfetivo = Exclude<Tema, "sistema">;

export const TEMA_PADRAO: Tema = "sistema";
export const CHAVE_TEMA = "concurso:tema";
export const CONSULTA_ESCURO = "(prefers-color-scheme: dark)";

export const ROTULO_TEMA: Readonly<Record<Tema, string>> = {
  claro: "Claro",
  escuro: "Escuro",
  sistema: "Sistema",
};

/** Valor salvo → tema válido (qualquer valor desconhecido vira o padrão). */
export function normalizarTema(valor: unknown): Tema {
  return TEMAS.includes(valor as Tema) ? (valor as Tema) : TEMA_PADRAO;
}

/** Tema que de fato vale, dado o preferido e se o sistema está no modo escuro. */
export function resolverTema(tema: Tema, sistemaEscuro: boolean): TemaEfetivo {
  if (tema === "sistema") return sistemaEscuro ? "escuro" : "claro";
  return tema;
}

/** Aplica o tema efetivo ao documento (classe `dark` e `color-scheme`). */
export function aplicarTema(raiz: HTMLElement, efetivo: TemaEfetivo): void {
  raiz.classList.toggle("dark", efetivo === "escuro");
  raiz.style.colorScheme = efetivo === "escuro" ? "dark" : "light";
}

/**
 * Script inline (executado antes da pintura) que lê a preferência e aplica o tema, e cria a
 * `<meta name="theme-color">` da barra de status do PWA (#66, ver `sincronizarCorTema`).
 * Autocontido: não pode depender de nada do bundle.
 */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});if(t!=="claro"&&t!=="escuro")t="sistema";var e=t==="escuro"||(t==="sistema"&&matchMedia(${JSON.stringify(CONSULTA_ESCURO)}).matches);var r=document.documentElement;r.classList.toggle("dark",e);r.style.colorScheme=e?"dark":"light";var m=document.querySelector(${JSON.stringify(SELETOR_META_COR)});if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m)}m.content=e?${JSON.stringify(COR_TEMA.escuro)}:${JSON.stringify(COR_TEMA.claro)}}catch(_){}})()`;
