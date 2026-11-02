import { expect, type Page, test } from "@playwright/test";
import { cadastrarConcurso, emDias, unico } from "./utils";

// Responsividade (#48): celular de ~360 px, com toque (`pointer: coarse`).
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

/** Largura rolável do documento = largura da tela (sem rolagem horizontal da página). */
async function semRolagemHorizontal(page: Page, rota: string) {
  await page.goto(rota);
  await page.waitForLoadState("networkidle");
  const { rolavel, tela, largos } = await page.evaluate(() => {
    const tela = document.documentElement.clientWidth;
    // Diagnóstico: os elementos mais internos que passam da borda direita da tela.
    const largos = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 && r.right > tela + 0.5 && el.closest("[class*='overflow-x-auto']") === null
        );
      })
      .filter((el, _, todos) => !todos.some((outro) => outro !== el && el.contains(outro)))
      .slice(0, 5)
      .map(
        (el) =>
          `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}"> ${Math.round(el.getBoundingClientRect().right)}px: ${(el.textContent ?? "").trim().slice(0, 60)}`,
      );
    return { rolavel: document.documentElement.scrollWidth, tela, largos };
  });
  expect(rolavel, `${rota} rola na horizontal:\n${largos.join("\n")}`).toBeLessThanOrEqual(tela);
}

test("mobile: telas principais sem rolagem horizontal em 360 px", async ({ page }) => {
  const url = await cadastrarConcurso(page, {
    orgao: `Tribunal Regional Federal da Terceira Região ${unico()}`,
    cargo: "Analista Judiciário — Área Judiciária — Especialidade Oficial de Justiça",
    tags: ["prioridade", "tribunais"],
  });
  const id = new URL(url).pathname;

  // Um prazo para o dashboard e o calendário terem conteúdo.
  await page.getByRole("tab", { name: /Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Prova objetiva" });
  await dialogo.getByLabel("Título").fill("Prova objetiva");
  await dialogo.getByLabel("Data").fill(emDias(10));
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  for (const rota of [
    "/",
    "/concursos",
    "/concursos?visao=quadro",
    "/calendario",
    "/configuracoes",
    "/notificacoes",
    "/concursos/novo",
    id,
    `${id}/editar`,
    "/admin",
    "/admin/usuarios",
    "/admin/acesso",
    "/admin/auditoria",
  ]) {
    await semRolagemHorizontal(page, rota);
  }
});

test("mobile: navegação inferior e alvos de toque de pelo menos 40 px", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);

  // Botões e campos crescem em telas de toque (sem mudar o desktop).
  await page.goto("/concursos");
  const botao = page.getByRole("button", { name: "Buscar" });
  expect((await botao.boundingBox())?.height).toBeGreaterThanOrEqual(40);
  const busca = page
    .getByRole("searchbox")
    .or(page.getByPlaceholder(/Buscar/))
    .first();
  expect((await busca.boundingBox())?.height).toBeGreaterThanOrEqual(40);
});
