/**
 * Checagem de sessão no servidor (defesa em profundidade, além do `proxy.ts`): Server Actions e
 * Route Handlers chamam estas funções antes de ler ou gravar dados (ARQUITETURA.md §5.2, §7.1).
 */
import { cookies, headers } from "next/headers";
import { type ErrosAcao, falha } from "../actions/resultado";
import { lerConfigAuth } from "./config";
import { COOKIE_SESSAO, tokenSessaoValido } from "./sessao";

export const MENSAGEM_SESSAO_EXPIRADA = "Sessão expirada. Entre novamente para continuar.";

/** `true` se a autenticação está desligada ou se a requisição tem sessão válida. */
export async function sessaoAtiva(): Promise<boolean> {
  const config = lerConfigAuth();
  if (!config.habilitada) return true;
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  return tokenSessaoValido(token, config.segredo);
}

/** Para Server Actions: `null` se autorizado; senão o resultado de falha a devolver. */
export async function verificarAcesso(): Promise<{ ok: false; erros: ErrosAcao } | null> {
  return (await sessaoAtiva()) ? null : falha(MENSAGEM_SESSAO_EXPIRADA);
}

/** Para Route Handlers: `null` se autorizado; senão uma resposta 401. */
export async function respostaNaoAutorizada(): Promise<Response | null> {
  return (await sessaoAtiva())
    ? null
    : Response.json(falha(MENSAGEM_SESSAO_EXPIRADA), { status: 401 });
}

/** Identifica o cliente para o limite de tentativas de login. */
export async function chaveCliente(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
