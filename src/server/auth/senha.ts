/** Comparação de senha em tempo constante (ARQUITETURA.md §7.1). */
import { createHash, timingSafeEqual } from "node:crypto";

const resumo = (texto: string) => createHash("sha256").update(texto, "utf8").digest();

/**
 * `true` se `informada` é igual a `esperada`. Compara os SHA-256 com `timingSafeEqual`, de modo
 * que o tempo não depende do conteúdo nem do tamanho das senhas.
 */
export function senhaConfere(informada: string, esperada: string): boolean {
  return timingSafeEqual(resumo(informada), resumo(esperada));
}
