/**
 * Autorização do painel admin (#50): páginas em `/admin` e Server Actions administrativas exigem o
 * papel `ADMIN`, relido do banco a cada requisição (`usuarioAtual`). Não admin recebe 403
 * (`forbidden()` nas páginas; falha "Acesso restrito" nas ações). A visão escolhida (`visao.ts`)
 * nunca concede acesso.
 */
import { cookies } from "next/headers";
import { forbidden } from "next/navigation";
import { type ErrosAcao, falha } from "../actions/resultado";
import {
  exigirUsuarioPagina,
  MENSAGEM_SESSAO_EXPIRADA,
  type UsuarioSessao,
  usuarioAtual,
} from "./acesso";
import { COOKIE_VISAO, type Visao, visaoEfetiva } from "./visao";

export const MENSAGEM_SEM_PERMISSAO = "Acesso restrito a administradores.";

/** Para páginas do painel: o admin; sem sessão, vai ao login; sem o papel, 403. */
export async function exigirAdminPagina(): Promise<UsuarioSessao> {
  const usuario = await exigirUsuarioPagina();
  if (usuario.papel !== "ADMIN") forbidden();
  return usuario;
}

/** Para Server Actions administrativas: o admin, ou a falha a devolver. */
export async function exigirAdminAcao(): Promise<
  { ok: true; usuario: UsuarioSessao } | { ok: false; erros: ErrosAcao }
> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha(MENSAGEM_SESSAO_EXPIRADA);
  if (usuario.papel !== "ADMIN") return falha(MENSAGEM_SEM_PERMISSAO);
  return { ok: true, usuario };
}

/** Visão em vigor para o usuário da requisição ("usuario" para quem não é admin). */
export async function visaoAtual(usuario: Pick<UsuarioSessao, "papel">): Promise<Visao> {
  return visaoEfetiva((await cookies()).get(COOKIE_VISAO)?.value, usuario.papel);
}
