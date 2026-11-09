/**
 * `/api/mcp` (issues #39, #49): servidor MCP por Streamable HTTP para uso hospedado. Exige
 * `Authorization: Bearer <token>` com o token pessoal do usuário (gerado em Configurações); o
 * servidor só enxerga os dados do dono do token. Independente do login (clientes MCP não têm o
 * cookie de sessão), por isso a rota é pública no `proxy.ts`. O token só vale enquanto o dono puder
 * usar o app (mesma regra da sessão, #96). Falhas de token seguidas sofrem atraso progressivo, como
 * o login. Localmente, prefira o `pnpm mcp` (stdio).
 */
import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { revalidatePath } from "next/cache";
import { chaveCliente, registrarUsoDoToken } from "@/server/auth/acesso";
import { donoDoTokenAutorizado } from "@/server/auth/autorizacao";
import { lerConfigAuth } from "@/server/auth/config";
import { LimitadorTentativas } from "@/server/auth/limitador";
import { getDb } from "@/server/db/client";
import { log } from "@/server/log";
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
    { onerror: (erro) => log.error("mcp.erro", { erro }) },
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
  const db = getDb();
  const dono = token === null ? null : await usuarioDoTokenMcp(db, token);
  const autorizado = dono !== null && (await donoDoTokenAutorizado(db, lerConfigAuth(), dono));
  const usuario = autorizado ? dono : null;
  if (token === null || usuario === null) {
    log.warn("auth.token_invalido", {
      rota: "mcp",
      ip: chave,
      ausente: token === null,
      ...(dono !== null && { usuarioId: dono.id, motivo: "sem_acesso" }),
    });
    // Só token inexistente conta como tentativa: o de quem perdeu o acesso é real (não é força
    // bruta) e um feed antigo consultado sem parar atrasaria outros usuários do mesmo IP.
    const bloqueio = dono === null ? limitador.registrarFalha(chave) : 0;
    if (bloqueio > 0) {
      log.warn("auth.limite_tentativas", { rota: "mcp", ip: chave, esperaMs: bloqueio });
    }
    return texto("Token ausente ou inválido.", 401, { "WWW-Authenticate": 'Bearer realm="mcp"' });
  }
  limitador.registrarSucesso(chave);
  await registrarUsoDoToken(usuario.id, "mcp", token);
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
