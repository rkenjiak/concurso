/**
 * Os dois passos do login Google (#49) para os Route Handlers `/api/auth/google` e
 * `/api/auth/google/callback`. Erros esperados voltam para `/login?erro=<código>` (ver
 * `MENSAGENS_ERRO_LOGIN`); detalhes ficam só no log do servidor.
 */
import { NextResponse } from "next/server";
import { getDb } from "../db/client";
import { log, mascararEmail } from "../log";
import { entrarComGoogle } from "../repositories/usuarios";
import { decidirLoginGoogle } from "./autorizacao";
import { type ConfigAuth, ErroConfigAuth, lerConfigAuth } from "./config";
import {
  aleatorio,
  CAMINHO_CALLBACK,
  COOKIE_OAUTH,
  criarCookieOAuth,
  DURACAO_OAUTH_S,
  ErroLoginGoogle,
  lerCookieOAuth,
  trocarCodigo,
  urlAutorizacao,
  validarIdToken,
} from "./google";
import { COOKIE_SESSAO, criarTokenSessao, destinoSeguro, opcoesCookieSessao } from "./sessao";

/** Códigos de erro do login exibidos na página `/login`. */
export const MENSAGENS_ERRO_LOGIN = {
  nao_autorizado:
    "Esta conta Google não tem acesso. Peça ao administrador para incluir o seu e-mail.",
  bloqueado: "Esta conta foi bloqueada pelo administrador.",
  google: "Não foi possível entrar com o Google. Tente novamente.",
  cancelado: "Login com o Google cancelado.",
  expirado: "O login demorou demais ou foi aberto em outra aba. Tente novamente.",
} as const;
export type ErroLogin = keyof typeof MENSAGENS_ERRO_LOGIN;

const producao = () => process.env.NODE_ENV === "production";

/**
 * Origem pública do app para a URL de callback: `APP_URL`, se definido (útil atrás de proxy
 * reverso), senão a da requisição.
 */
export function origemPublica(request: { nextUrl: URL }): string {
  const configurada = process.env.APP_URL?.trim();
  return configurada ? new URL(configurada).origin : request.nextUrl.origin;
}

const CAMINHO_COOKIE_OAUTH = "/api/auth";

function apagarCookieOAuth(resposta: NextResponse): void {
  resposta.cookies.set(COOKIE_OAUTH, "", { path: CAMINHO_COOKIE_OAUTH, maxAge: 0 });
}

function irParaLogin(origem: string, erro: ErroLogin): NextResponse {
  const url = new URL("/login", origem);
  url.searchParams.set("erro", erro);
  const resposta = NextResponse.redirect(url);
  apagarCookieOAuth(resposta);
  return resposta;
}

type ConfigComGoogle = Extract<ConfigAuth, { habilitada: true }> & {
  google: NonNullable<Extract<ConfigAuth, { habilitada: true }>["google"]>;
};

function configGoogle(): ConfigComGoogle | null {
  try {
    const config = lerConfigAuth();
    return config.habilitada && config.google ? (config as ConfigComGoogle) : null;
  } catch (erro) {
    if (erro instanceof ErroConfigAuth) return null;
    throw erro;
  }
}

/** `GET /api/auth/google?para=/caminho`: guarda o estado e redireciona para o Google. */
export async function iniciarLoginGoogle(request: { nextUrl: URL }): Promise<NextResponse> {
  const origem = origemPublica(request);
  const config = configGoogle();
  if (!config) return NextResponse.redirect(new URL("/login", origem));
  const estado = {
    state: aleatorio(),
    nonce: aleatorio(),
    verificador: aleatorio(48),
    para: destinoSeguro(request.nextUrl.searchParams.get("para")),
  };
  const resposta = NextResponse.redirect(
    urlAutorizacao(config.google, new URL(CAMINHO_CALLBACK, origem).toString(), estado),
  );
  resposta.cookies.set(COOKIE_OAUTH, await criarCookieOAuth(config.segredo, estado), {
    httpOnly: true,
    secure: producao(),
    // `lax`: o cookie precisa acompanhar a navegação de volta do Google (GET de outro site).
    sameSite: "lax",
    path: CAMINHO_COOKIE_OAUTH,
    maxAge: DURACAO_OAUTH_S,
  });
  return resposta;
}

/**
 * `GET /api/auth/google/callback?code&state`: confere o estado, valida o `id_token`, aplica a
 * allowlist (variáveis e painel admin) e o bloqueio, encontra/cria o usuário e abre a sessão.
 */
export async function concluirLoginGoogle(request: {
  nextUrl: URL;
  cookies: { get(nome: string): { value: string } | undefined };
}): Promise<NextResponse> {
  const origem = origemPublica(request);
  const config = configGoogle();
  if (!config) return NextResponse.redirect(new URL("/login", origem));
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return irParaLogin(origem, "cancelado");

  const estado = await lerCookieOAuth(request.cookies.get(COOKIE_OAUTH)?.value, config.segredo);
  const code = params.get("code");
  if (!estado || !code || params.get("state") !== estado.state) {
    return irParaLogin(origem, "expirado");
  }

  try {
    const redirectUri = new URL(CAMINHO_CALLBACK, origem).toString();
    const idToken = await trocarCodigo(config.google, redirectUri, code, estado.verificador);
    const perfil = await validarIdToken(idToken, config.google, estado.nonce);
    const decisao = await decidirLoginGoogle(getDb(), config, perfil);
    if (decisao !== "ok") {
      log.warn("auth.login_falhou", {
        metodo: "google",
        motivo: decisao,
        email: mascararEmail(perfil.email),
      });
      return irParaLogin(origem, decisao);
    }
    const usuario = await entrarComGoogle(getDb(), perfil, config.emailsAdmin.has(perfil.email));
    log.info("auth.login_ok", { metodo: "google", usuarioId: usuario.id });
    const resposta = NextResponse.redirect(new URL(estado.para, origem));
    apagarCookieOAuth(resposta);
    resposta.cookies.set(
      COOKIE_SESSAO,
      await criarTokenSessao(config.segredo, { usuarioId: usuario.id, metodo: "google" }),
      opcoesCookieSessao(producao()),
    );
    return resposta;
  } catch (erro) {
    if (!(erro instanceof ErroLoginGoogle)) throw erro;
    log.warn("auth.login_falhou", { metodo: "google", motivo: "erro_google", erro: erro.message });
    return irParaLogin(origem, "google");
  }
}
