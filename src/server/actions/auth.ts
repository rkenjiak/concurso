"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { chaveCliente } from "../auth/acesso";
import { lerConfigAuth } from "../auth/config";
import { LimitadorTentativas } from "../auth/limitador";
import { senhaConfere } from "../auth/senha";
import { COOKIE_SESSAO, criarTokenSessao, destinoSeguro, opcoesCookieSessao } from "../auth/sessao";

export interface EstadoLogin {
  erro: string | null;
}

/** Tamanho máximo aceito para a senha digitada (evita processar entradas enormes). */
const MAX_SENHA = 1_000;

// Um limitador por processo, preservado entre recargas do servidor de desenvolvimento.
const globalAuth = globalThis as typeof globalThis & { __limitadorLogin?: LimitadorTentativas };
globalAuth.__limitadorLogin ??= new LimitadorTentativas();
const limitador = globalAuth.__limitadorLogin;

/** Login com senha única (`APP_PASSWORD`); cria o cookie de sessão e volta para `para`. */
export async function login(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const config = lerConfigAuth();
  if (!config.habilitada) redirect("/");

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
    limitador.registrarFalha(chave);
    return { erro: "Senha incorreta." };
  }

  limitador.registrarSucesso(chave);
  (await cookies()).set(
    COOKIE_SESSAO,
    await criarTokenSessao(config.segredo),
    opcoesCookieSessao(process.env.NODE_ENV === "production"),
  );
  redirect(destinoSeguro(form.get("para")));
}

/** Encerra a sessão e volta para o login. */
export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
  redirect("/login");
}
