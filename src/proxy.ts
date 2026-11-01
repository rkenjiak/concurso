/**
 * Proteção das rotas (ARQUITETURA.md §7.1). Com a autenticação ligada, exige sessão válida em
 * todas as rotas, exceto `/login`, `/api/health`, `/api/mcp` (autenticada pelo próprio handler
 * com `MCP_TOKEN`) e os arquivos estáticos (ver `matcher`).
 * Server Actions e Route Handlers checam a sessão de novo (defesa em profundidade).
 */
import { type NextRequest, NextResponse } from "next/server";
import { type ConfigAuth, lerConfigAuth } from "./server/auth/config";
import { COOKIE_SESSAO, tokenSessaoValido } from "./server/auth/sessao";

const ROTAS_PUBLICAS = new Set(["/api/health", "/api/mcp"]);

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
  if (ROTAS_PUBLICAS.has(pathname)) return NextResponse.next();

  const autenticado = await tokenSessaoValido(
    request.cookies.get(COOKIE_SESSAO)?.value,
    config.segredo,
  );
  if (pathname === "/login") {
    return autenticado ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
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
  // Tudo, exceto arquivos estáticos do Next e ícones.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
