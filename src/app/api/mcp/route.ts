/**
 * `/api/mcp` (issues #39, #49): servidor MCP por Streamable HTTP para uso hospedado. Exige
 * `Authorization: Bearer <token>` com o token pessoal do usuário (gerado em Configurações); o
 * servidor só enxerga os dados do dono do token. Independente do login (clientes MCP não têm o
 * cookie de sessão), por isso a rota é pública no `proxy.ts`. Falhas de token seguidas sofrem
 * atraso progressivo, como o login. Localmente, prefira o `pnpm mcp` (stdio).
 */
import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { revalidatePath } from "next/cache";
import { chaveCliente } from "@/server/auth/acesso";
import { LimitadorTentativas } from "@/server/auth/limitador";
import { getDb } from "@/server/db/client";
import { tokenBearer } from "@/server/mcp/config";
import { criarServidorMcp } from "@/server/mcp/servidor";
import { usuarioDoTokenMcp } from "@/server/repositories/usuarios";

const limitador = new LimitadorTentativas();

let handler: McpHttpHandler | undefined;

/**
 * Handler criado sob demanda; cada requisição recebe uma instância nova do servidor, presa ao
 * usuário do token (repassado em `authInfo.extra.usuarioId`).
 */
function obterHandler(): McpHttpHandler {
  handler ??= createMcpHandler(
    ({ authInfo }) => {
      const usuarioId = authInfo?.extra?.usuarioId;
      if (typeof usuarioId !== "number") throw new Error("Requisição MCP sem usuário.");
      return criarServidorMcp({
        db: getDb(),
        usuarioId,
        // Dados mudaram: todas as páginas leem do banco.
        aoAlterar: () => revalidatePath("/", "layout"),
      });
    },
    { onerror: (erro) => console.error("MCP:", erro) },
  );
  return handler;
}

const texto = (corpo: string, status: number, headers: Record<string, string> = {}) =>
  new Response(corpo, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

async function atender(request: Request): Promise<Response> {
  const chave = await chaveCliente();
  const espera = limitador.esperaMs(chave);
  if (espera > 0) {
    return texto("Muitas tentativas. Aguarde.", 429, {
      "Retry-After": String(Math.ceil(espera / 1000)),
    });
  }
  const token = tokenBearer(request.headers.get("authorization"));
  const usuario = token === null ? null : await usuarioDoTokenMcp(getDb(), token);
  if (token === null || usuario === null) {
    limitador.registrarFalha(chave);
    return texto("Token ausente ou inválido.", 401, { "WWW-Authenticate": 'Bearer realm="mcp"' });
  }
  limitador.registrarSucesso(chave);
  return obterHandler().fetch(request, {
    authInfo: {
      token,
      clientId: `usuario-${usuario.id}`,
      scopes: [],
      extra: { usuarioId: usuario.id },
    },
  });
}

export const GET = atender;
export const POST = atender;
export const DELETE = atender;
