import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { caminhoCompartilhado } from "../src/lib/compartilhamento";
import { concursoSchema, VALORES_INICIAIS_CONCURSO } from "../src/lib/schemas/concurso";
import { COOKIE_SESSAO, criarTokenSessao } from "../src/server/auth/sessao";
import { criarDb } from "../src/server/db/client";
import { emailPermitido, ID_USUARIO_INICIAL, usuario } from "../src/server/db/schema";
import { ativarCompartilhamento } from "../src/server/repositories/compartilhamento";
import { criarConcurso } from "../src/server/repositories/concursos";
import { esperarInvalidacaoIsr, unico } from "./utils";

const SEGREDO_GOOGLE = "segredo-google-somente-para-testes-e2e-0123456789";
const bancoGoogle = () => criarDb({ url: "file:./e2e/.tmp/google-auth.db", authToken: "" });

// Projeto `google` (#129): verifica invalidação imediata do cache ISR quando o admin bloqueia,
// desbloqueia, remove e-mail da allowlist ou rebaixa um usuário dono de link compartilhado.
test("bloquear, remover e-mail ou rebaixar no painel admin invalida compartilhamento na hora (#129)", async ({
  page,
  request,
  baseURL,
}) => {
  const id = unico();
  const emailBia = `bia-${id}@e2e.test`;
  const emailCarla = `carla-${id}@e2e.test`;
  const { db, client } = bancoGoogle();

  let tokenBia = "";
  let tokenCarla = "";

  try {
    await db
      .update(usuario)
      .set({ email: "admin@e2e.test", nome: "Admin E2E", googleSub: "sub-admin-e2e" })
      .where(eq(usuario.id, ID_USUARIO_INICIAL));

    const [bia] = await db
      .insert(usuario)
      .values({ email: emailBia, nome: "Bia E2E", googleSub: `sub-bia-${id}`, papel: "USUARIO" })
      .returning({ id: usuario.id });
    if (!bia) throw new Error("usuário bia não criado");
    await db.insert(emailPermitido).values({ email: emailBia });
    const cidBia = await criarConcurso(
      db,
      bia.id,
      concursoSchema.parse({ ...VALORES_INICIAIS_CONCURSO, orgao: `Bia ${id}`, cargo: "Analista" }),
    );
    tokenBia = (await ativarCompartilhamento(db, bia.id, cidBia)).token;

    const [carla] = await db
      .insert(usuario)
      .values({
        email: emailCarla,
        nome: "Carla E2E",
        googleSub: `sub-carla-${id}`,
        papel: "ADMIN",
      })
      .returning({ id: usuario.id });
    if (!carla) throw new Error("usuário carla não criado");
    const cidCarla = await criarConcurso(
      db,
      carla.id,
      concursoSchema.parse({
        ...VALORES_INICIAIS_CONCURSO,
        orgao: `Carla ${id}`,
        cargo: "Técnico",
      }),
    );
    tokenCarla = (await ativarCompartilhamento(db, carla.id, cidCarla)).token;
  } finally {
    client.close();
  }

  const caminhoBia = caminhoCompartilhado(tokenBia);
  const caminhoCarla = caminhoCompartilhado(tokenCarla);

  // Popula o cache ISR dos dois links antes das ações do admin.
  expect((await request.get(caminhoBia)).status()).toBe(200);
  expect((await request.get(caminhoCarla)).status()).toBe(200);

  const jwtAdmin = await criarTokenSessao(new TextEncoder().encode(SEGREDO_GOOGLE), {
    usuarioId: ID_USUARIO_INICIAL,
    metodo: "google",
  });
  await page.context().addCookies([{ name: COOKIE_SESSAO, value: jwtAdmin, url: baseURL }]);

  // 1. Bloquear → devolve 404 (MISS); Desbloquear → volta a devolver 200 (MISS).
  await page.goto("/admin/usuarios");
  await page.getByRole("button", { name: `Bloquear ${emailBia}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Bloquear" }).click();
  await expect(page.getByRole("button", { name: `Desbloquear ${emailBia}` })).toBeVisible();
  await esperarInvalidacaoIsr(request, caminhoBia, 404);

  await page.getByRole("button", { name: `Desbloquear ${emailBia}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Desbloquear" }).click();
  await expect(page.getByRole("button", { name: `Bloquear ${emailBia}` })).toBeVisible();
  await esperarInvalidacaoIsr(request, caminhoBia, 200);

  // 2. Remover e-mail do painel → devolve 404 (MISS).
  await page.goto("/admin/acesso");
  const itemAcesso = page.getByRole("listitem").filter({ hasText: emailBia });
  await itemAcesso.getByRole("button", { name: `Retirar ${emailBia}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retirar" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: emailBia })).toHaveCount(0);
  await esperarInvalidacaoIsr(request, caminhoBia, 404);

  // 3. Rebaixar admin (que estava fora das listas) → devolve 404 (MISS).
  await page.goto("/admin/usuarios");
  await page.getByRole("button", { name: `Rebaixar ${emailCarla}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Rebaixar" }).click();
  await expect(page.getByRole("button", { name: `Promover ${emailCarla} a admin` })).toBeVisible();
  await esperarInvalidacaoIsr(request, caminhoCarla, 404);
});
