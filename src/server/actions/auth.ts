"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { chaveCliente, usuarioAtual } from "../auth/acesso";
import { lerConfigAuth } from "../auth/config";
import { LimitadorTentativas } from "../auth/limitador";
import { senhaConfere } from "../auth/senha";
import { COOKIE_SESSAO, criarTokenSessao, destinoSeguro, opcoesCookieSessao } from "../auth/sessao";
import { COOKIE_VISAO } from "../auth/visao";
import { getDb } from "../db/client";
import { ID_USUARIO_INICIAL } from "../db/schema";
import { log } from "../log";
import { obterUsuario, registrarAcesso } from "../repositories/usuarios";

export interface EstadoLogin {
  erro: string | null;
}

/** Tamanho máximo aceito para a senha digitada (evita processar entradas enormes). */
const MAX_SENHA = 1_000;

// Um limitador por processo, preservado entre recargas do servidor de desenvolvimento.
const globalAuth = globalThis as typeof globalThis & { __limitadorLogin?: LimitadorTentativas };
globalAuth.__limitadorLogin ??= new LimitadorTentativas();
const limitador = globalAuth.__limitadorLogin;

/**
 * Login com senha única (`APP_PASSWORD`, uso local): entra como o usuário inicial, cria o cookie
 * de sessão e volta para `para`.
 */
export async function login(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const config = lerConfigAuth();
  if (!config.habilitada) redirect("/");
  if (config.senha === null) return { erro: "Login por senha desativado. Entre com o Google." };

  const chave = await chaveCliente();
  const espera = limitador.esperaMs(chave);
  if (espera > 0) {
    return {
      erro: `Muitas tentativas incorretas. Tente novamente em ${Math.ceil(espera / 1000)} s.`,
    };
  }

  const senha = form.get("senha");
  if (typeof senha !== "string" || senha === "" || senha.length > MAX_SENHA) {
    return { erro: "Informe a senha." };
  }
  if (!senhaConfere(senha, config.senha)) {
    log.warn("auth.login_falhou", { metodo: "senha", motivo: "senha_incorreta", ip: chave });
    const bloqueio = limitador.registrarFalha(chave);
    if (bloqueio > 0) {
      log.warn("auth.limite_tentativas", { rota: "login", ip: chave, esperaMs: bloqueio });
    }
    return { erro: "Senha incorreta." };
  }

  limitador.registrarSucesso(chave);
  // Com senha, o bloqueio só é conferido depois que ela confere.
  if ((await obterUsuario(getDb(), ID_USUARIO_INICIAL))?.bloqueadoEm != null) {
    log.warn("auth.login_falhou", {
      metodo: "senha",
      motivo: "conta_bloqueada",
      usuarioId: ID_USUARIO_INICIAL,
      ip: chave,
    });
    return { erro: "Esta conta foi bloqueada pelo administrador." };
  }
  await registrarAcesso(getDb(), ID_USUARIO_INICIAL);
  log.info("auth.login_ok", { metodo: "senha", usuarioId: ID_USUARIO_INICIAL });
  (await cookies()).set(
    COOKIE_SESSAO,
    await criarTokenSessao(config.segredo, { usuarioId: ID_USUARIO_INICIAL, metodo: "senha" }),
    opcoesCookieSessao(process.env.NODE_ENV === "production"),
  );
  redirect(destinoSeguro(form.get("para")));
}

/** Encerra a sessão (e esquece a visão admin/usuário) e volta para o login. */
export async function logout(): Promise<void> {
  log.info("auth.logout", { usuarioId: (await usuarioAtual())?.id });
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
  jar.delete(COOKIE_VISAO);
  redirect("/login");
}
