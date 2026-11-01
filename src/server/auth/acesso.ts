/**
 * Usuário da requisição (#49) e checagem de sessão no servidor (defesa em profundidade, além do
 * `proxy.ts`): páginas, Server Actions e Route Handlers obtêm o usuário por estas funções antes de
 * ler ou gravar dados, e passam o ID dele a todas as queries e repositórios (ARQUITETURA.md §7.1).
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Papel } from "@/domain/enums";
import { type ErrosAcao, falha } from "../actions/resultado";
import { getDb } from "../db/client";
import { usuarioDaSessao } from "./autorizacao";
import { lerConfigAuth } from "./config";
import { COOKIE_SESSAO, lerSessao } from "./sessao";

export const MENSAGEM_SESSAO_EXPIRADA = "Sessão expirada. Entre novamente para continuar.";

export interface UsuarioSessao {
  id: number;
  email: string | null;
  nome: string | null;
  avatarUrl: string | null;
  papel: Papel;
}

/**
 * Usuário autenticado, ou `null`. Sem login configurado, é sempre o usuário inicial (uso local).
 * A sessão só vale enquanto o método usado continuar permitido e o usuário não estiver bloqueado
 * (regras em `autorizacao.ts`). Memorizado por requisição.
 */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const config = lerConfigAuth();
  const sessao = config.habilitada
    ? await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value, config.segredo)
    : null;
  const u = await usuarioDaSessao(getDb(), config, sessao);
  if (!u) return null;
  return { id: u.id, email: u.email, nome: u.nome, avatarUrl: u.avatarUrl, papel: u.papel };
});

/** Para páginas: o usuário autenticado; sem sessão, redireciona para o login. */
export async function exigirUsuarioPagina(): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Para Server Actions: o usuário, ou o resultado de falha a devolver. */
export async function exigirUsuarioAcao(): Promise<
  { ok: true; usuario: UsuarioSessao } | { ok: false; erros: ErrosAcao }
> {
  const usuario = await usuarioAtual();
  return usuario ? { ok: true, usuario } : falha(MENSAGEM_SESSAO_EXPIRADA);
}

/** Para Route Handlers: o usuário, ou uma resposta 401. */
export async function exigirUsuarioRota(): Promise<UsuarioSessao | Response> {
  const usuario = await usuarioAtual();
  return usuario ?? Response.json(falha(MENSAGEM_SESSAO_EXPIRADA), { status: 401 });
}

/** Identifica o cliente para o limite de tentativas de login. */
export async function chaveCliente(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
