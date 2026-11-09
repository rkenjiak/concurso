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
import { log } from "../log";
import { registrarAcessoSessao, registrarUsoToken } from "../repositories/usuarios";
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
 *
 * Registra também o último acesso real (#108). Fica aqui, e não em `usuarioDaSessao` (pura, usada
 * no callback do Google) nem no `proxy.ts`. Notas:
 * - o `cache()` só deduplica dentro de uma renderização; Server Actions e Route Handlers podem
 *   chamar esta função mais de uma vez. Quem limita as escritas é o throttle no próprio `UPDATE`
 *   (no máximo uma a cada 15 min por usuário), então não há memória extra no processo;
 * - prefetch de rotas dinâmicas também passa por aqui e conta como acesso (aceitável: é o usuário
 *   navegando no app);
 * - todos os chamadores são dinâmicos (`connection()`, `searchParams` ou parâmetros de rota), então
 *   a escrita nunca acontece no build/prerender, mesmo sem login (quando não há `cookies()`);
 * - uma falha (ex.: banco somente leitura) só gera um aviso no log.
 */
export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const config = lerConfigAuth();
  const sessao = config.habilitada
    ? await lerSessao((await cookies()).get(COOKIE_SESSAO)?.value, config.segredo)
    : null;
  const db = getDb();
  const u = await usuarioDaSessao(db, config, sessao);
  if (!u) return null;
  try {
    await registrarAcessoSessao(db, u.id);
  } catch (erro) {
    log.warn("auth.registro_acesso_falhou", { canal: "sessao", usuarioId: u.id, erro });
  }
  return { id: u.id, email: u.email, nome: u.nome, avatarUrl: u.avatarUrl, papel: u.papel };
});

/**
 * Registra o uso de um token pessoal já autorizado (`/api/mcp`, `/api/calendario.ics`, #108): o
 * último acesso e o último uso do token, com o mesmo throttle da sessão. Falhas só geram aviso.
 *
 * É aguardado (e não agendado com `after()`): é um único `UPDATE` pela chave primária que quase
 * sempre não altera nada (throttle), então o custo no caminho crítico é mínimo; e `after()` exige o
 * contexto de requisição do Next, o que tornaria a escrita assíncrona e os testes das rotas
 * dependentes de esperar o fim da resposta.
 */
export async function registrarUsoDoToken(
  usuarioId: number,
  canal: "mcp" | "ics",
  token: string,
): Promise<void> {
  try {
    await registrarUsoToken(getDb(), usuarioId, canal, token);
  } catch (erro) {
    log.warn("auth.registro_acesso_falhou", { canal, usuarioId, erro });
  }
}

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

/**
 * IP do cliente pelos cabeçalhos do proxy (`x-forwarded-for`, `x-real-ip`) ou `"local"`. Fora de um
 * proxy confiável o cliente pode forjá-lo: serve para limitar tentativas e para o log, não para
 * autorizar.
 */
export function chaveDosHeaders(h: { get(nome: string): string | null }): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Identifica o cliente para o limite de tentativas de login. */
export async function chaveCliente(): Promise<string> {
  return chaveDosHeaders(await headers());
}
