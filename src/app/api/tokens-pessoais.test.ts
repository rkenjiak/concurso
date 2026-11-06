/**
 * Rotas autenticadas por token pessoal (#96): `/api/mcp` e `/api/calendario.ics` recusam o token de
 * quem perdeu o acesso (e-mail retirado da allowlist, conta bloqueada), pela mesma regra da sessão.
 * Banco real em memória; o Next (`headers`, `revalidatePath`) e o banco global são simulados.
 */
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarBancoTeste, criarUsuarioTeste } from "@/server/db/banco-teste";
import type { Db } from "@/server/db/client";
import { emailPermitido, ID_USUARIO_INICIAL, usuario } from "@/server/db/schema";
import { definirBloqueio } from "@/server/repositories/admin";
import { gerarTokenIcs, gerarTokenMcp } from "@/server/repositories/usuarios";

const estado = vi.hoisted(() => ({ db: null as unknown as Db, ip: 0 }));

vi.mock("@/server/db/client", async (original) => ({
  ...(await original<typeof import("@/server/db/client")>()),
  getDb: () => estado.db,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// IP diferente a cada requisição: o atraso progressivo das falhas não interfere nos testes.
vi.mock("@/server/auth/acesso", () => ({ chaveCliente: async () => `ip-${estado.ip++}` }));

const mcp = await import("./mcp/route");
const ics = await import("./calendario.ics/route");

let client: Client;
let bia: number;

beforeEach(async () => {
  ({ db: estado.db, client } = await criarBancoTeste());
  await estado.db
    .update(usuario)
    .set({ email: "ana@x.com", googleSub: "g-ana", papel: "ADMIN" })
    .where(eq(usuario.id, ID_USUARIO_INICIAL));
  bia = await criarUsuarioTeste(estado.db, "bia@x.com");
  await estado.db.insert(emailPermitido).values({ email: "bia@x.com" });
  vi.stubEnv("GOOGLE_CLIENT_ID", "id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "segredo");
  vi.stubEnv("ADMIN_EMAILS", "ana@x.com");
  vi.stubEnv("ALLOWED_EMAILS", "carla@x.com");
  vi.stubEnv("AUTH_SECRET", "x".repeat(32));
  vi.stubEnv("APP_PASSWORD", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  client.close();
});

const chamarMcp = (token: string) =>
  mcp.POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "teste", version: "1.0.0" },
        },
      }),
    }),
  );

const chamarIcs = (token: string) =>
  ics.GET(new NextRequest(`http://localhost/api/calendario.ics?token=${token}`));

describe("tokens pessoais de quem perdeu o acesso (#96)", () => {
  it("e-mail retirado da allowlist do painel: MCP 401 e .ics 404", async () => {
    const tokenMcp = await gerarTokenMcp(estado.db, bia);
    const tokenIcs = await gerarTokenIcs(estado.db, bia);
    expect((await chamarMcp(tokenMcp)).status).toBe(200);
    expect((await chamarIcs(tokenIcs)).status).toBe(200);

    await estado.db.delete(emailPermitido).where(eq(emailPermitido.email, "bia@x.com"));
    const respostaMcp = await chamarMcp(tokenMcp);
    expect(respostaMcp.status).toBe(401);
    expect(respostaMcp.headers.get("www-authenticate")).toContain("Bearer");
    expect((await chamarIcs(tokenIcs)).status).toBe(404);

    // Liberar de novo devolve o acesso com os mesmos tokens (a regra é conferida a cada requisição).
    await estado.db.insert(emailPermitido).values({ email: "bia@x.com" });
    expect((await chamarMcp(tokenMcp)).status).toBe(200);
  });

  it("e-mail fora de ALLOWED_EMAILS perde o acesso; o que está nela continua", async () => {
    const carla = await criarUsuarioTeste(estado.db, "carla@x.com");
    const token = await gerarTokenMcp(estado.db, carla);
    expect((await chamarMcp(token)).status).toBe(200);
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect((await chamarMcp(token)).status).toBe(401);
  });

  it("admin de ADMIN_EMAILS continua valendo", async () => {
    const token = await gerarTokenIcs(estado.db, ID_USUARIO_INICIAL);
    expect((await chamarIcs(token)).status).toBe(200);
  });

  it("bloquear revoga os tokens; desbloquear não os devolve", async () => {
    const tokenMcp = await gerarTokenMcp(estado.db, bia);
    const tokenIcs = await gerarTokenIcs(estado.db, bia);
    const ana = { id: ID_USUARIO_INICIAL, email: "ana@x.com", nome: null };
    const opcoes = { emailsAdminFixos: new Set(["ana@x.com"]) };
    await definirBloqueio(estado.db, ana, bia, true, opcoes);
    expect((await chamarMcp(tokenMcp)).status).toBe(401);
    expect((await chamarIcs(tokenIcs)).status).toBe(404);
    await definirBloqueio(estado.db, ana, bia, false, opcoes);
    expect((await chamarMcp(tokenMcp)).status).toBe(401);
    expect((await chamarIcs(tokenIcs)).status).toBe(404);
  });
});
