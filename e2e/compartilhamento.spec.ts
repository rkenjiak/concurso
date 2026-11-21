import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { criarDb } from "../src/server/db/client";
import { concurso, evento, ID_USUARIO_INICIAL, usuario } from "../src/server/db/schema";
import { cadastrarConcurso, emDias, esperarInvalidacaoIsr, regiaoAvisos, unico } from "./utils";

const bancoE2e = () => criarDb({ url: "file:./e2e/.tmp/sem-auth.db", authToken: "" });

test("token malformado ou inexistente responde HTTP 404 real (#129)", async ({ page, request }) => {
  for (const rota of [
    "/compartilhado/invalido",
    "/compartilhado/curto",
    "/compartilhado/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "/compartilhado/token-com+barra!",
  ]) {
    const resposta = await page.goto(rota);
    expect(resposta?.status(), rota).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Link não encontrado" }),
    ).toBeVisible();
    await expect(page.locator("a")).toHaveCount(0);
    expect((await request.get(rota)).status(), `GET ${rota}`).toBe(404);
  }
});

test("compartilhamento público: DTO sem vazamentos, ilha cliente, 360 px e invalidação imediata (#129)", async ({
  page,
  browser,
  request,
}) => {
  const id = unico();
  const orgao = `TRF Pública ${id}`;
  const sentinelas = {
    concursoObs: `SENTINELA_CONCURSO_OBS_${id}`,
    statusObs: `SENTINELA_STATUS_OBS_${id}`,
    eventoLocal: `SENTINELA_EVENTO_LOCAL_${id}`,
    eventoObs: `SENTINELA_EVENTO_OBS_${id}`,
    provaLocal: `SENTINELA_PROVA_LOCAL_${id}`,
    provaObs: `SENTINELA_PROVA_OBS_${id}`,
    linkRotulo: `SENTINELA_LINK_ROTULO_${id}`,
    linkUrl: `https://sentinela-${id}.example.com/edital.pdf`,
    resultadoDesc: `SENTINELA_RESULTADO_DESC_${id}`,
    resultadoObs: `SENTINELA_RESULTADO_OBS_${id}`,
    tag: `sentinela-tag-${id}`,
    donoEmail: `dono-sentinela-${id}@exemplo.com`,
    donoNome: `Dono Sentinela ${id}`,
  };

  const { db, client } = bancoE2e();
  const [donoOriginal] = await db
    .select({ email: usuario.email, nome: usuario.nome })
    .from(usuario)
    .where(eq(usuario.id, ID_USUARIO_INICIAL));
  let concursoId: number | null = null;

  try {
    await db
      .update(usuario)
      .set({ email: sentinelas.donoEmail, nome: sentinelas.donoNome })
      .where(eq(usuario.id, ID_USUARIO_INICIAL));

    const url = await cadastrarConcurso(page, {
      orgao,
      cargo: "Analista Judiciário",
      tags: [sentinelas.tag],
      cor: "Azul",
      icone: "⚖️",
    });
    const detalhe = new URL(url).pathname;
    concursoId = Number(detalhe.split("/").pop());

    // Preenche dados públicos e privados (observações, remuneração, validade).
    await page.goto(`${detalhe}/editar`);
    await page.getByLabel("Banca organizadora").fill("FCC");
    await page.getByLabel("Esfera").selectOption({ label: "Federal" });
    await page.getByLabel("UF").selectOption("SP");
    await page.getByLabel("Cidade").fill("São Paulo");
    await page.getByLabel("Remuneração inicial").fill("1500000");
    await page.getByLabel("Data da homologação").fill("2026-01-10");
    await page.getByLabel("Validade (meses)").fill("24");
    await page.getByLabel("Observações gerais").fill(sentinelas.concursoObs);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page).toHaveURL(new RegExp(`${detalhe}$`));

    // Muda status com observação privada.
    await page.getByRole("button", { name: "Mudar status" }).click();
    const dlgStatus = page.getByRole("dialog", { name: "Mudar status" });
    await dlgStatus.getByLabel("Novo status").selectOption({ label: "Inscrito" });
    await dlgStatus.getByLabel("Observação (opcional)").fill(sentinelas.statusObs);
    await dlgStatus.getByRole("button", { name: "Alterar status" }).click();
    await expect(dlgStatus).toBeHidden();

    // Cadastra evento passado/concluído e prova futura com local e observação privados.
    await page.getByRole("tab", { name: /^Eventos/ }).click();
    await page.getByRole("button", { name: "Adicionar evento" }).click();
    const dlgEvento = page.getByRole("dialog", { name: "Novo evento" });
    await dlgEvento.getByLabel("Tipo").selectOption({ label: "Fim das inscrições" });
    await dlgEvento.getByLabel("Data").fill(emDias(-3));
    await dlgEvento.getByLabel("Local").fill(sentinelas.eventoLocal);
    await dlgEvento.getByLabel("Observação").fill(sentinelas.eventoObs);
    await dlgEvento.getByLabel("Concluído").check();
    await dlgEvento.getByRole("button", { name: "Salvar e adicionar outro" }).click();
    await expect(dlgEvento.getByRole("status")).toContainText("salvo");

    await dlgEvento.getByLabel("Tipo").selectOption({ label: "Prova objetiva" });
    await dlgEvento.getByLabel("Título").fill(`Prova objetiva — manhã ${id}`);
    await dlgEvento.getByLabel("Data").fill(emDias(5));
    await dlgEvento.getByLabel("Hora").fill("09:00");
    await dlgEvento.getByLabel("Local").fill(sentinelas.provaLocal);
    await dlgEvento.getByLabel("Observação").fill(sentinelas.provaObs);
    await dlgEvento.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dlgEvento).toBeHidden();

    // Evento marcado como oculto no dashboard deve aparecer normalmente no link compartilhado.
    await db.insert(evento).values({
      concursoId,
      tipo: "RESULTADO_FINAL",
      titulo: `Resultado oculto no painel ${id}`,
      data: emDias(12),
      ocultoDashboard: true,
    });

    // Cadastra link e resultado privados.
    await page.getByRole("tab", { name: /^Links/ }).click();
    await page.getByRole("button", { name: "Adicionar link" }).click();
    const dlgLink = page.getByRole("dialog", { name: "Novo link" });
    await dlgLink.getByLabel("Rótulo").fill(sentinelas.linkRotulo);
    await dlgLink.getByLabel("URL").fill(sentinelas.linkUrl);
    await dlgLink.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dlgLink).toBeHidden();

    await page.getByRole("tab", { name: /^Resultados/ }).click();
    await page.getByRole("button", { name: "Adicionar resultado" }).click();
    const dlgRes = page.getByRole("dialog", { name: "Novo resultado" });
    await dlgRes.getByLabel("Descrição").fill(sentinelas.resultadoDesc);
    await dlgRes.getByLabel("Nota", { exact: true }).fill("88");
    await dlgRes.getByLabel("Observação").fill(sentinelas.resultadoObs);
    await dlgRes.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dlgRes).toBeHidden();

    // Limpa os avisos acumulados acima (MAX_VISIVEIS = 3) e confirma a persistência antes de abrir o menu.
    await page.reload();

    // Ativa o compartilhamento pelo menu "Mais ações".
    await expect(page.getByTestId("indicador-compartilhado")).toHaveCount(0);
    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Compartilhar…" }).click();
    const dlgCompartilhar = page.getByRole("dialog", { name: "Compartilhar cronograma" });
    await expect(dlgCompartilhar).toContainText("O que fica visível");
    await expect(dlgCompartilhar).toContainText("O que continua privado");
    await dlgCompartilhar.getByRole("button", { name: "Ativar compartilhamento" }).click();

    const campoUrl = dlgCompartilhar.getByTestId("url-compartilhamento");
    await expect(campoUrl).toHaveValue(/\/compartilhado\/[A-Za-z0-9_-]{32}$/);
    const url1 = await campoUrl.inputValue();
    const caminho1 = new URL(url1).pathname;
    const token1 = caminho1.split("/").pop() ?? "";
    await expect(regiaoAvisos(page)).toContainText("Link público ativado.");
    await expect(page.getByTestId("indicador-compartilhado")).toBeVisible();

    // 1. HTML bruto e payload RSC: cabeçalhos, sem sentinelas e sem datas relativas no SSR.
    const respHtml = await request.get(caminho1);
    expect(respHtml.status()).toBe(200);
    expect(respHtml.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(respHtml.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(respHtml.headers()["x-frame-options"]).toBe("DENY");
    expect(respHtml.headers()["x-content-type-options"]).toBe("nosniff");
    const html = await respHtml.text();
    expect(html).toContain(`${orgao} — Analista Judiciário`);
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
    expect(html).not.toContain("em 5 dias");
    expect(html).not.toContain("há 3 dias");

    const respRsc = await request.get(caminho1, { headers: { RSC: "1" } });
    expect(respRsc.status()).toBe(200);
    const rsc = await respRsc.text();

    for (const textoPrivado of Object.values(sentinelas)) {
      expect(html, `HTML vazou: ${textoPrivado}`).not.toContain(textoPrivado);
      expect(rsc, `RSC vazou: ${textoPrivado}`).not.toContain(textoPrivado);
    }

    // 2. Navegação pública (contexto isolado, sem console errors, 360px e ilha cliente ativa).
    const contextoPublico = await browser.newContext({
      viewport: { width: 360, height: 740 },
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    const paginaPublica = await contextoPublico.newPage();
    const erros: string[] = [];
    paginaPublica.on("console", (m) => {
      if (m.type() === "error") erros.push(m.text());
    });
    paginaPublica.on("pageerror", (e) => erros.push(e.message));

    await paginaPublica.goto(caminho1);
    await expect(paginaPublica.getByRole("heading", { level: 1, name: orgao })).toBeVisible();
    await expect(paginaPublica.getByText("Analista Judiciário")).toBeVisible();
    await expect(paginaPublica.getByText("FCC")).toBeVisible();
    await expect(paginaPublica.getByText("Federal")).toBeVisible();
    await expect(paginaPublica.getByText("São Paulo / SP")).toBeVisible();
    await expect(paginaPublica.getByText(/Dados de \d{2}\/\d{2} \d{2}:\d{2}/)).toBeVisible();
    await expect(paginaPublica.getByTestId("contagem-prova-publica")).toContainText(
      "faltam 5 dias",
    );
    await expect(paginaPublica.getByRole("heading", { name: /^Próximos/ })).toBeVisible();
    await expect(
      paginaPublica.getByRole("heading", { name: /^Passados e concluídos/ }),
    ).toBeVisible();
    await expect(paginaPublica.getByText("em 5 dias", { exact: true })).toBeVisible();
    await expect(paginaPublica.getByText("há 3 dias", { exact: true })).toBeVisible();
    await expect(paginaPublica.getByText(`Resultado oculto no painel ${id}`)).toBeVisible();
    await expect(
      paginaPublica.getByRole("heading", { level: 2, name: "Validade do concurso" }),
    ).toBeVisible();
    await expect(paginaPublica.getByText("Vigente", { exact: true })).toBeVisible();
    await expect(
      paginaPublica.getByRole("heading", { level: 2, name: "Histórico de status" }),
    ).toBeVisible();
    await expect(paginaPublica.locator("a")).toHaveCount(0);
    expect(
      await paginaPublica.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
    expect(erros).toEqual([]);
    await contextoPublico.close();

    // 3. Painel admin exibe apenas contagens agregadas (nunca o token).
    const adminPage = await browser.newPage();
    await adminPage.goto("/admin");
    await expect(adminPage.getByText("Concursos compartilhados")).toBeVisible();
    expect(await adminPage.content()).not.toContain(token1);
    await adminPage.goto(`/admin/usuarios/${ID_USUARIO_INICIAL}`);
    await expect(adminPage.getByText("Compartilhados")).toBeVisible();
    expect(await adminPage.content()).not.toContain(token1);
    expect(await adminPage.content()).not.toContain("/compartilhado/");
    await adminPage.close();

    // 4. Regenerar link (com confirmação) invalida o token antigo no cache ISR.
    await dlgCompartilhar.getByRole("button", { name: "Gerar novo link" }).click();
    await dlgCompartilhar.getByRole("button", { name: "Confirmar novo link" }).click();
    await expect(campoUrl).not.toHaveValue(url1);
    const url2 = await campoUrl.inputValue();
    const caminho2 = new URL(url2).pathname;
    await esperarInvalidacaoIsr(request, caminho1, 404);
    expect((await request.get(caminho2)).status()).toBe(200);

    // 5. Revogar (com confirmação) invalida o token no cache ISR e remove o indicador.
    await dlgCompartilhar.getByRole("button", { name: "Revogar acesso" }).click();
    await dlgCompartilhar.getByRole("button", { name: "Confirmar revogação" }).click();
    await expect(
      dlgCompartilhar.getByRole("button", { name: "Ativar compartilhamento" }),
    ).toBeVisible();
    await esperarInvalidacaoIsr(request, caminho2, 404);
    await dlgCompartilhar.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByTestId("indicador-compartilhado")).toHaveCount(0);

    // 6. Excluir concurso compartilhado invalida o cache na hora.
    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Compartilhar…" }).click();
    await dlgCompartilhar.getByRole("button", { name: "Ativar compartilhamento" }).click();
    await expect(campoUrl).toHaveValue(/\/compartilhado\/[A-Za-z0-9_-]{32}$/);
    const caminho3 = new URL(await campoUrl.inputValue()).pathname;
    expect((await request.get(caminho3)).status()).toBe(200);
    await page.keyboard.press("Escape");
    await expect(dlgCompartilhar).toBeHidden();

    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: /^Excluir/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await expect(page).toHaveURL(/\/concursos$/);
    await esperarInvalidacaoIsr(request, caminho3, 404);
  } finally {
    if (concursoId !== null) await db.delete(concurso).where(eq(concurso.id, concursoId));
    await db
      .update(usuario)
      .set({ email: donoOriginal?.email ?? null, nome: donoOriginal?.nome ?? null })
      .where(eq(usuario.id, ID_USUARIO_INICIAL));
    client.close();
  }
});
