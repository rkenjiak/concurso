import { expect, type Locator, type Page, test } from "@playwright/test";
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
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
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

/** Caixa do elemento com pelo menos 44 × 44 px e dentro da tela de 360 px. */
async function alvoDeToque(alvo: Locator) {
  const caixa = await alvo.boundingBox();
  expect(caixa?.width).toBeGreaterThanOrEqual(44);
  expect(caixa?.height).toBeGreaterThanOrEqual(44);
  expect(caixa?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);
}

test("mobile: navegação inferior e alvos de toque de pelo menos 40 px", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(nav).toBeVisible();

  // Barra inferior (#105): Notificações no lugar de Configurações, quatro itens em 360 px, sem
  // rótulo cortado e com alvos de 44 px.
  const itens = nav.getByRole("link");
  // O texto do item Notificações inclui o selo do contador, quando há não lidas.
  await expect(itens).toHaveText(["Dashboard", "Concursos", "Calendário", /Notificações$/]);
  await expect(nav.getByRole("link", { name: "Configurações" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: /^Notificações \(/ })).toBeVisible();
  for (const item of await itens.all()) {
    await alvoDeToque(item);
    // O rótulo (último filho) cabe inteiro na célula do item.
    const cortado = await item.evaluate((el) => {
      const rotulo = el.lastElementChild?.getBoundingClientRect();
      const celula = el.getBoundingClientRect();
      return !rotulo || rotulo.left < celula.left - 0.5 || rotulo.right > celula.right + 0.5;
    });
    expect(cortado, `rótulo cortado: ${await item.textContent()}`).toBe(false);
  }

  await nav.getByRole("link", { name: "Calendário" }).click();
  await expect(page).toHaveURL(/\/calendario$/);
  await expect(nav.getByRole("link", { name: "Calendário" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Configurações pelo menu da conta (#105), com alvos de 44 px no gatilho e no item.
  const gatilho = page.getByRole("banner").getByRole("button", { name: "Menu da conta" });
  await alvoDeToque(gatilho);
  await gatilho.click();
  const configuracoes = page.getByRole("menu").getByRole("menuitem", { name: "Configurações" });
  await expect(configuracoes).toBeVisible();
  // Medido depois da animação de abertura do menu (zoom).
  await expect
    .poll(async () => (await configuracoes.boundingBox())?.height)
    .toBeGreaterThanOrEqual(44);
  await configuracoes.click();
  await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
  await gatilho.click();
  await expect(
    page.getByRole("menu").getByRole("menuitem", { name: "Configurações" }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");

  // Botões e campos crescem em telas de toque (sem mudar o desktop).
  // Cabeçalho (#77): o botão "Atualizar" cabe em 360 px, com alvo de toque de 40 px.
  const atualizar = page.getByRole("banner").getByTestId("botao-atualizar");
  await expect(atualizar).toBeVisible();
  const caixa = await atualizar.boundingBox();
  expect(caixa?.width).toBeGreaterThanOrEqual(40);
  expect(caixa?.height).toBeGreaterThanOrEqual(40);
  expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);

  await page.goto("/concursos");
  const botao = page.getByRole("button", { name: "Buscar" });
  expect((await botao.boundingBox())?.height).toBeGreaterThanOrEqual(40);
  const busca = page
    .getByRole("searchbox")
    .or(page.getByPlaceholder(/Buscar/))
    .first();
  expect((await busca.boundingBox())?.height).toBeGreaterThanOrEqual(40);
});

test("mobile: menu da conta pelo teclado leva a Configurações com Enter (#105)", async ({
  page,
}) => {
  await page.goto("/");
  const gatilho = page.getByRole("banner").getByRole("button", { name: "Menu da conta" });
  // Avatar sem nome nem e-mail (usuário local) mostra o ícone de pessoa, não "?".
  await expect(gatilho).not.toContainText("?");

  await gatilho.focus();
  await page.keyboard.press("Enter");
  const configuracoes = page.getByRole("menu").getByRole("menuitem", { name: "Configurações" });
  await expect(configuracoes).toBeVisible();
  // O foco entra no primeiro item (Visão usuário, para admins); desce até Configurações.
  for (let i = 0; i < 5; i++) {
    if (await configuracoes.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(configuracoes).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/configuracoes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
});
