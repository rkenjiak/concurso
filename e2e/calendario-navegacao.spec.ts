import { expect, type Page, test } from "@playwright/test";
import { mesDaData } from "../src/domain/calendario";
import { formatarMes } from "../src/lib/format";
import { hojeSP } from "../src/lib/tz";
import { cadastrarConcurso, emDias, unico } from "./utils";

async function adicionarEvento(page: Page, tipo: string, titulo: string, data: string) {
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: tipo });
  await dialogo.getByLabel("Título").fill(titulo);
  await dialogo.getByLabel("Data").fill(data);
  await dialogo.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialogo).toBeHidden();
}

const idDaUrl = (url: string) => Number(/\/concursos\/(\d+)/.exec(url)?.[1]);

/** Dois concursos com eventos no mesmo mês, daqui a ~3 meses. */
async function prepararDados(page: Page) {
  const id = unico();
  const orgaoA = `Nav A ${id}`;
  const orgaoB = `Nav B ${id}`;
  const provaA = `Prova nav ${id}`;
  const outroB = `Outro nav ${id}`;
  const data = emDias(95);
  const urlA = await cadastrarConcurso(page, {
    orgao: orgaoA,
    cargo: "Analista",
    status: "Inscrito",
  });
  await adicionarEvento(page, "Prova objetiva", provaA, data);
  const urlB = await cadastrarConcurso(page, {
    orgao: orgaoB,
    cargo: "Técnico",
    status: "Inscrito",
  });
  await adicionarEvento(page, "Outro", outroB, data);
  return {
    nomeA: `${orgaoA} — Analista`,
    nomeB: `${orgaoB} — Técnico`,
    idA: idDaUrl(urlA),
    idB: idDaUrl(urlB),
    provaA,
    outroB,
    data,
    mesEvento: mesDaData(data),
  };
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("calendário: navegação rápida e filtro de concursos mantido ao trocar de mês (desktop)", async ({
  page,
}) => {
  const d = await prepararDados(page);
  const mesHoje = mesDaData(hojeSP());
  const filtroA = `concursos=${d.idA}`;

  await page.goto(`/calendario?mes=${d.mesEvento}`);
  const celula = page.locator(`td[data-data="${d.data}"]`);
  await expect(celula.getByRole("button", { name: d.provaA })).toBeVisible();
  await expect(celula.getByRole("button", { name: d.outroB })).toBeVisible();

  // Legenda clicável: toggles com aria-pressed e o nome do concurso.
  const filtro = page.getByRole("region", { name: "Filtro de concursos" });
  const toggleA = filtro.getByRole("button", { name: d.nomeA, exact: true });
  const toggleB = filtro.getByRole("button", { name: d.nomeB, exact: true });
  await expect(toggleA).toHaveAttribute("aria-pressed", "true");
  await expect(toggleB).toHaveAttribute("aria-pressed", "true");

  // "Só este": a seleção vai para a URL.
  await filtro.getByRole("button", { name: `Mostrar só ${d.nomeA}` }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${d.mesEvento}&${filtroA}$`));
  await expect(celula.getByRole("button", { name: d.outroB })).toHaveCount(0);
  await expect(celula.getByRole("button", { name: d.provaA })).toBeVisible();
  await expect(toggleA).toHaveAttribute("aria-pressed", "true");
  await expect(toggleB).toHaveAttribute("aria-pressed", "false");

  // A seleção acompanha os links de navegação entre meses.
  await page.getByRole("link", { name: "Próximo mês" }).click();
  await expect(page).toHaveURL(new RegExp(`${filtroA}$`));
  await expect(page).not.toHaveURL(new RegExp(`mes=${d.mesEvento}`));
  await page.getByRole("link", { name: "Mês anterior" }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${d.mesEvento}&${filtroA}$`));
  await expect(celula.getByRole("button", { name: d.outroB })).toHaveCount(0);

  // Atalho "Próxima prova", a partir de hoje, com o filtro.
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${mesHoje}&${filtroA}$`));
  await page.getByRole("link", { name: /^Próxima prova:/ }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${d.mesEvento}&${filtroA}$`));
  await expect(celula.getByRole("button", { name: d.provaA })).toBeVisible();

  // Atalho "Próximos eventos": só A tem eventos com o filtro.
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await page.getByRole("link", { name: /^Próximos eventos:/ }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${d.mesEvento}&${filtroA}$`));

  // Seletor de mês e ano: de hoje até o mês do evento em poucos cliques.
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${mesHoje}&`));
  await escolherMes(page, d.mesEvento, 1);
  await expect(page).toHaveURL(new RegExp(`mes=${d.mesEvento}&${filtroA}$`));
  await expect(page.getByRole("button", { name: /escolher mês e ano/ })).toContainText(
    formatarMes(d.mesEvento),
  );

  // Religar B: os dois aparecem; "Mostrar todos" limpa o filtro da URL.
  await toggleB.click();
  await expect(toggleB).toHaveAttribute("aria-pressed", "true");
  await expect(celula.getByRole("button", { name: d.outroB })).toBeVisible();
  // Com só A e B no banco, os dois = todos (sem parâmetro); senão, os dois na URL.
  await expect(async () => {
    const selecao = new URL(page.url()).searchParams.get("concursos");
    if (selecao !== null)
      expect(selecao.split(",").map(Number)).toEqual(expect.arrayContaining([d.idA, d.idB]));
  }).toPass();
  const todos = filtro.getByRole("button", { name: "Mostrar todos" });
  if (await todos.isVisible()) await todos.click();
  await expect(page).toHaveURL(new RegExp(`/calendario[?]mes=${d.mesEvento}$`));
  await expect(toggleA).toHaveAttribute("aria-pressed", "true");

  // Desligar um concurso partindo de "todos".
  await toggleA.click();
  await expect(toggleA).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/concursos=/);
  await expect(page).not.toHaveURL(new RegExp(`concursos=(.*,)?${d.idA}(,|$)`));
  await expect(celula.getByRole("button", { name: d.provaA })).toHaveCount(0);
  await expect(celula.getByRole("button", { name: d.outroB })).toBeVisible();
});

async function escolherMes(page: Page, mes: string, eventos: number) {
  await page.getByRole("button", { name: /escolher mês e ano/ }).click();
  const seletor = page.getByRole("dialog", { name: "Escolher mês e ano" });
  await expect(seletor).toBeVisible();
  const ano = Number(mes.slice(0, 4));
  const anoAtual = Number(hojeSP().slice(0, 4));
  for (let a = anoAtual; a < ano; a++)
    await seletor.getByRole("button", { name: "Próximo ano" }).click();
  await expect(seletor).toContainText(String(ano));
  const rotulo = `${formatarMes(mes)}, ${eventos === 1 ? "1 evento" : `${eventos} eventos`}`;
  await seletor.getByRole("link", { name: new RegExp(`^${escapar(rotulo)}$`) }).click();
  await expect(seletor).toBeHidden();
}

test("calendário no celular (360 px): seletor de mês, atalhos e filtro", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const d = await prepararDados(page);
  const filtroB = `concursos=${d.idB}`;

  await page.goto(`/calendario?mes=${d.mesEvento}&${filtroB}`);
  await expect(page.getByRole("button", { name: new RegExp(escapar(d.outroB)) })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(escapar(d.provaA)) })).toHaveCount(0);

  // Sem rolagem horizontal na largura mínima.
  const largura = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largura).toBeLessThanOrEqual(360);

  // Trocar de mês mantém o filtro; o seletor traz de volta ao mês do evento.
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${filtroB}$`));
  await escolherMes(page, d.mesEvento, 1);
  await expect(page).toHaveURL(new RegExp(`mes=${d.mesEvento}&${filtroB}$`));
  await expect(page.getByRole("button", { name: new RegExp(escapar(d.outroB)) })).toBeVisible();

  // B não tem provas; ligar A (listado por ter eventos no mês) traz a prova de A.
  const filtro = page.getByRole("region", { name: "Filtro de concursos" });
  await filtro.getByRole("button", { name: d.nomeA, exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(escapar(d.provaA)) })).toBeVisible();
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await page.getByRole("link", { name: /^Próxima prova:/ }).click();
  await expect(page).toHaveURL(new RegExp(`mes=${d.mesEvento}&concursos=`));

  // "Só este" no celular.
  await filtro.getByRole("button", { name: `Mostrar só ${d.nomeA}` }).click();
  await expect(page).toHaveURL(new RegExp(`concursos=${d.idA}$`));
  await expect(page.getByRole("button", { name: new RegExp(escapar(d.outroB)) })).toHaveCount(0);
});
