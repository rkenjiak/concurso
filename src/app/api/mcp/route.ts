/**
 * `/api/mcp` (issue #39): servidor MCP por Streamable HTTP para uso hospedado. Desligado (404)
 * sem `MCP_TOKEN`; com ele, exige `Authorization: Bearer <MCP_TOKEN>` — independente do login por
 * senha, por isso a rota é pública no `proxy.ts`. Falhas de token seguidas sofrem atraso
 * progressivo, como o login. Localmente, prefira o `pnpm mcp` (stdio).
 */
import { createMcpHandler, type McpHttpHandler } from "@modelcontextprotocol/server";
import { revalidatePath } from "next/cache";
import { chaveCliente } from "@/server/auth/acesso";
import { LimitadorTentativas } from "@/server/auth/limitador";
import { senhaConfere } from "@/server/auth/senha";
import { getDb } from "@/server/db/client";
import { type ConfigMcp, lerConfigMcp, tokenBearer } from "@/server/mcp/config";
import { criarServidorMcp } from "@/server/mcp/servidor";

const limitador = new LimitadorTentativas();

let handler: McpHttpHandler | undefined;

/** Handler criado sob demanda; cada requisição recebe uma instância nova do servidor. */
function obterHandler(): McpHttpHandler {
  handler ??= createMcpHandler(
    () =>
      criarServidorMcp({
        db: getDb(),
        // Dados mudaram: todas as páginas leem do banco.
        aoAlterar: () => revalidatePath("/", "layout"),
      }),
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
  let config: ConfigMcp;
  try {
    config = lerConfigMcp();
  } catch (erro) {
    console.error(erro);
    return texto("Configuração do MCP inválida. Veja os logs do servidor.", 500);
  }
  if (!config.habilitado) return texto("Não encontrado.", 404);

  const chave = await chaveCliente();
  const espera = limitador.esperaMs(chave);
  if (espera > 0) {
    return texto("Muitas tentativas. Aguarde.", 429, {
      "Retry-After": String(Math.ceil(espera / 1000)),
    });
  }
  const token = tokenBearer(request.headers.get("authorization"));
  if (token === null || !senhaConfere(token, config.token)) {
    limitador.registrarFalha(chave);
    return texto("Token ausente ou inválido.", 401, { "WWW-Authenticate": 'Bearer realm="mcp"' });
  }
  limitador.registrarSucesso(chave);
  return obterHandler().fetch(request);
}

export const GET = atender;
export const POST = atender;
export const DELETE = atender;
