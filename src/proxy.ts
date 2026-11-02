/**
 * Proteção das rotas (ARQUITETURA.md §7.1). Com a autenticação ligada, exige sessão válida em
 * todas as rotas, exceto `/login`, `/api/health`, o fluxo do login Google (`/api/auth/google…`),
 * `/api/mcp` e `/api/calendario.ics` (#65; autenticadas pelo próprio handler com o token do
 * usuário), o manifest e os ícones do PWA (#66, buscados pelo navegador sem sessão) e os arquivos
 * estáticos (ver `matcher`). Aqui só
 * se confere a assinatura do cookie (sem banco); páginas, Server Actions e Route Handlers obtêm o
 * usuário de novo (`auth/acesso.ts`), o que também barra sessões de e-mails retirados da allowlist.
 */
import { type NextRequest, NextResponse } from "next/server";
import { ehArquivoPwaPublico } from "./lib/pwa";
import { type ConfigAuth, lerConfigAuth } from "./server/auth/config";
import { COOKIE_SESSAO, tokenSessaoValido } from "./server/auth/sessao";

const ROTAS_PUBLICAS = new Set([
  "/login",
  "/api/health",
  "/api/mcp",
  "/api/calendario.ics",
  "/api/auth/google",
  "/api/auth/google/callback",
]);

export async function proxy(request: NextRequest) {
  let config: ConfigAuth;
  try {
    config = lerConfigAuth();
  } catch (erro) {
    console.error(erro);
    return new NextResponse("Configuração de autenticação inválida. Veja os logs do servidor.", {
      status: 500,
    });
  }
  if (!config.habilitada) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (ROTAS_PUBLICAS.has(pathname) || ehArquivoPwaPublico(pathname)) return NextResponse.next();

  const autenticado = await tokenSessaoValido(
    request.cookies.get(COOKIE_SESSAO)?.value,
    config.segredo,
  );
  if (autenticado) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, erros: { _form: ["Sessão expirada. Entre novamente para continuar."] } },
      { status: 401 },
    );
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("para", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Tudo, exceto arquivos estáticos do Next, o manifest e os ícones do PWA (ver `lib/pwa.ts`).
  // Precisa ser literal (analisado no build).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/).*)",
  ],
};
