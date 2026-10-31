/**
 * Erro de regra de negócio. A mensagem é em pt-BR e pode ser exibida diretamente ao usuário.
 */
export class ErroDominio extends Error {
  override readonly name = "ErroDominio";
}
