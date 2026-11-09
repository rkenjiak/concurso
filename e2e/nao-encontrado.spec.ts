import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { criarDb } from "../src/server/db/client";
import { concurso, ID_USUARIO_INICIAL, usuario } from "../src/server/db/schema";
import { cadastrarConcurso, unico } from "./utils";

// Status HTTP de verdade nas rotas [id] (#110): a checagem roda num layout acima do loading.tsx,
// antes de o stream fixar o 200.

/** Banco do servidor sem auth (projeto `chromium`, ver `playwright.config.ts`). */
const bancoE2e = () => criarDb({ url: "file:./e2e/.tmp/sem-auth.db", authToken: "" });

const NAO_ENCONTRADA = "This page could not be found.";

test("[id] inexistente ou malformado responde 404 com a página de não encontrado", async ({
  page,
}) => {
  for (const rota of [
    "/concursos/999999",
    "/concursos/abc",
    "/concursos/1e3",
    "/concursos/999999/editar",
    "/concursos/abc/editar",
    "/admin/usuarios/999999",
    "/admin/usuarios/abc",
  ]) {
    const resposta = await page.goto(rota);
    expect(resposta?.status(), rota).toBe(404);
    await expect(page.getByText(NAO_ENCONTRADA)).toBeVisible();
  }
});

test("concurso de outro usuário responde 404, inclusive na edição", async ({ page }) => {
  const { db, client } = bancoE2e();
  let outroId: number | undefined;
  try {
    const [outro] = await db
      .insert(usuario)
      .values({ email: `outro-${unico()}@exemplo.com`, nome: "Outro usuário" })
      .returning({ id: usuario.id });
    if (!outro) throw new Error("usuário não inserido");
    outroId = outro.id;
    const [alheio] = await db
      .insert(concurso)
      .values({
        usuarioId: outro.id,
        orgao: `Alheio ${unico()}`,
        cargo: "Analista",
        status: "PREVISTO",
        statusDesde: new Date(),
      })
      .returning({ id: concurso.id });
    if (!alheio) throw new Error("concurso não inserido");

    for (const rota of [`/concursos/${alheio.id}`, `/concursos/${alheio.id}/editar`]) {
      const resposta = await page.goto(rota);
      expect(resposta?.status(), rota).toBe(404);
      await expect(page.getByText(NAO_ENCONTRADA)).toBeVisible();
    }
    // O admin vê o outro usuário no painel (só agregados): o detalhe responde 200.
    expect((await page.goto(`/admin/usuarios/${outro.id}`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Outro usuário" })).toBeVisible();
  } finally {
    // Não deixa o outro usuário para os demais testes (o banco é compartilhado).
    if (outroId !== undefined) {
      await db.delete(concurso).where(eq(concurso.usuarioId, outroId));
      await db.delete(usuario).where(eq(usuario.id, outroId));
    }
    client.close();
  }
});

test("ID válido responde 200 no detalhe e na edição", async ({ page }) => {
  const orgao = `Existente ${unico()}`;
  const url = await cadastrarConcurso(page, { orgao, cargo: "Técnico" });

  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: orgao })).toBeVisible();
  expect((await page.goto(`${url}/editar`))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Editar concurso" })).toBeVisible();
  expect((await page.goto(`/admin/usuarios/${ID_USUARIO_INICIAL}`))?.status()).toBe(200);
});

test("/admin/* para quem não é admin continua 403", async ({ page }) => {
  const { db, client } = bancoE2e();
  try {
    // Sem login, o usuário é o inicial: rebaixado direto no banco só durante o teste e restaurado
    // no `finally` (os testes rodam em série, ver `playwright.config.ts`).
    await db.update(usuario).set({ papel: "USUARIO" }).where(eq(usuario.id, ID_USUARIO_INICIAL));
    for (const rota of ["/admin", "/admin/usuarios", `/admin/usuarios/${ID_USUARIO_INICIAL}`]) {
      expect((await page.goto(rota))?.status(), rota).toBe(403);
    }
    // Mesmo com ID inexistente: o papel é conferido antes (403, não 404).
    expect((await page.goto("/admin/usuarios/999999"))?.status()).toBe(403);
  } finally {
    await db.update(usuario).set({ papel: "ADMIN" }).where(eq(usuario.id, ID_USUARIO_INICIAL));
    client.close();
  }
});

/** Segura a resposta da navegação (RSC, sem prefetch) para `caminho` até `liberar()`. */
async function segurarNavegacao(page: Page, caminho: string) {
  let liberar = () => {};
  const segurando = new Promise<void>((r) => {
    liberar = r;
  });
  await page.route(
    (url) => url.pathname === caminho,
    async (rota) => {
      const h = rota.request().headers();
      if (h.rsc === "1" && !h["next-router-prefetch"]) await segurando;
      await rota.continue();
    },
  );
  return liberar;
}

test("as listagens continuam com o esqueleto ao navegar (#73)", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  let liberar = await segurarNavegacao(page, "/concursos");
  await page
    .getByRole("navigation")
    .first()
    .getByRole("link", { name: "Concursos", exact: true })
    .click();
  await expect(page.getByTestId("esqueleto")).toBeVisible();
  liberar();
  await expect(page.getByRole("heading", { level: 1, name: "Concursos" })).toBeVisible();
  await expect(page.getByTestId("esqueleto")).toBeHidden();

  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  liberar = await segurarNavegacao(page, "/admin/usuarios");
  await page
    .getByRole("navigation", { name: "Navegação do painel admin" })
    .getByRole("link", { name: "Usuários" })
    .click();
  await expect(page.getByTestId("esqueleto")).toBeVisible();
  liberar();
  await expect(page.getByRole("heading", { level: 1, name: "Usuários" })).toBeVisible();
  await expect(page.getByTestId("esqueleto")).toBeHidden();
});
