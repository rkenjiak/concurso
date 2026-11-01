import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { expect, test } from "@playwright/test";
import { SENHA_E2E } from "./constantes";

test("endpoint MCP exige o token pessoal e cadastra um concurso visível no app", async ({
  page,
  request,
  baseURL,
}) => {
  // Sem token (ou com token errado) responde 401 — mesmo sem sessão, a rota não redireciona.
  expect((await request.post("/api/mcp", { data: {} })).status()).toBe(401);
  const errado = await request.post("/api/mcp", {
    data: {},
    headers: { Authorization: "Bearer token-errado-token-errado-token-errado" },
  });
  expect(errado.status()).toBe(401);
  expect(errado.headers()["www-authenticate"]).toContain("Bearer");

  // O token pessoal é gerado em Configurações (só aparece uma vez).
  await page.goto("/login");
  await page.getByLabel("Senha").fill(SENHA_E2E);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Gerar token" }).click();
  const campo = page.getByLabel(/Novo token/);
  await expect(campo).toHaveValue(/^cmcp_/);
  const token = await campo.inputValue();
  await expect(page.getByRole("button", { name: "Revogar" })).toBeVisible();

  const cliente = new Client({ name: "e2e", version: "0.0.0" });
  await cliente.connect(
    new StreamableHTTPClientTransport(new URL("/api/mcp", baseURL), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  try {
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name)).toContain("cadastrar_concurso");

    const r = await cliente.callTool({
      name: "cadastrar_concurso",
      arguments: {
        concurso: {
          orgao: "Agência Nacional de Testes via MCP",
          cargo: "Especialista em Regulação",
          banca: "Cebraspe",
          remuneracao: 16413.35,
        },
        eventos: [{ tipo: "PROVA_OBJETIVA", data: "2099-03-15", hora: "08:00" }],
        links: [{ tipo: "EDITAL_ABERTURA", url: "https://example.com/edital.pdf" }],
      },
    });
    expect(r.isError).toBeFalsy();
  } finally {
    await cliente.close();
  }

  // O concurso aparece no app, nos dados do dono do token.
  await page.goto("/concursos?q=testes+via+mcp");
  await page
    .getByRole("link", { name: /Agência Nacional de Testes via MCP/ })
    .first()
    .click();
  await expect(page.getByText("Especialista em Regulação").first()).toBeVisible();
  await expect(page.getByText("R$ 16.413,35").first()).toBeVisible();

  // Token revogado deixa de valer.
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByRole("button", { name: "Gerar token" })).toBeVisible();
  const revogado = await request.post("/api/mcp", {
    data: {},
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(revogado.status()).toBe(401);
});
