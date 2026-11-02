import { expect, test } from "@playwright/test";
import { SENHA_E2E } from "./constantes";
import { cadastrarConcurso, emDias, unico } from "./utils";

test("lembretes: notificação no app, feed .ics assinável e revogado (#65)", async ({
  page,
  request,
}) => {
  // O feed é público no proxy (o calendário não tem sessão): sem token válido, 404 sem redirecionar.
  expect((await request.get("/api/calendario.ics", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/api/calendario.ics?token=cics_errado")).status()).toBe(404);

  await page.goto("/login");
  await page.getByLabel("Senha").fill(SENHA_E2E);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  const orgao = `Lembrete E2E ${unico()}`;
  await cadastrarConcurso(page, { orgao, cargo: "Analista", status: "Inscrito" });
  await page.getByRole("tab", { name: /^Eventos/ }).click();
  await page.getByRole("button", { name: "Adicionar evento" }).click();
  const dialogo = page.getByRole("dialog", { name: "Novo evento" });
  await dialogo.getByLabel("Tipo").selectOption({ label: "Fim das inscrições" });
  await dialogo.getByLabel("Data").fill(emDias(1));
  await dialogo.getByRole("button", { name: "Salvar" }).click();
  await expect(dialogo).toBeHidden();

  // Regra padrão (7, 1 e 0 dias): aviso "amanhã" no sino.
  const sino = page.getByRole("link", { name: /^Notificações \(\d+ não lidas?\)/ }).first();
  await expect(sino).toBeVisible();
  await sino.click();
  await expect(page).toHaveURL(/\/notificacoes$/);
  const item = page
    .getByTestId("lista-notificacoes")
    .getByRole("listitem")
    .filter({ hasText: orgao });
  await expect(item).toContainText("Fim das inscrições é amanhã");
  await item.getByRole("button", { name: /^Marcar como lida/ }).click();
  await expect(item).toHaveAttribute("data-lida", "true");
  await page.reload();
  await expect(
    page.getByTestId("lista-notificacoes").getByRole("listitem").filter({ hasText: orgao }),
  ).toHaveAttribute("data-lida", "true");

  // Feed: o link aparece só ao gerar; funciona sem sessão e mostra o evento do dono.
  await page.goto("/configuracoes");
  await page.getByRole("button", { name: "Gerar link de assinatura" }).click();
  const campo = page.getByTestId("url-feed-ics");
  await expect(campo).toHaveValue(/\/api\/calendario\.ics\?token=cics_/);
  const url = new URL(await campo.inputValue());
  const feed = await request.get(`${url.pathname}${url.search}`);
  expect(feed.status()).toBe(200);
  expect(feed.headers()["content-type"]).toContain("text/calendar");
  const ics = await feed.text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics.replace(/\r\n /g, "")).toContain(`Fim das inscrições — ${orgao}`);
  expect(ics).toContain(`DTSTART;VALUE=DATE:${emDias(1).replaceAll("-", "")}`);

  // Revogado, deixa de funcionar.
  await page.getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByRole("button", { name: "Gerar link de assinatura" })).toBeVisible();
  expect((await request.get(`${url.pathname}${url.search}`)).status()).toBe(404);
});
