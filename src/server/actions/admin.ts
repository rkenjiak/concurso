"use server";

/**
 * Server Actions do painel admin (#50). Todas exigem o papel `ADMIN` relido do banco
 * (`exigirAdminAcao`); não admins recebem "Acesso restrito a administradores." As regras (último
 * admin ativo, admins de `ADMIN_EMAILS`, auditoria) ficam em `repositories/admin.ts`.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PAPEL } from "@/domain/enums";
import { exigirAdminAcao } from "../auth/admin";
import { lerConfigAuth } from "../auth/config";
import { getDb } from "../db/client";
import {
  adicionarEmailPermitido,
  definirBloqueio,
  definirPapel,
  type OpcoesAdmin,
  removerEmailPermitido,
} from "../repositories/admin";
import { executar, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const idSchema = z.number({ error: "Usuário inválido." }).int().positive("Usuário inválido.");
const papelSchema = z.enum(PAPEL, { error: "Papel inválido." });
const bloqueadoSchema = z.boolean({ error: "Valor inválido." });
const emailSchema = z
  .string({ error: "Informe o e-mail." })
  .trim()
  .toLowerCase()
  .max(254, "E-mail longo demais.")
  .pipe(z.email({ error: "E-mail inválido." }));

function opcoesAdmin(): OpcoesAdmin {
  const config = lerConfigAuth();
  return { emailsAdminFixos: config.habilitada ? config.emailsAdmin : new Set() };
}

const atualizarPainel = () => revalidatePath("/admin", "layout");

/** Promove a admin ou rebaixa a usuário comum. Quem se rebaixa volta para a visão usuário. */
export async function definirPapelAcao(
  usuarioIdBruto: unknown,
  papelBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = idSchema.safeParse(usuarioIdBruto);
  if (!usuarioId.success) return falhaValidacao(usuarioId.error);
  const papel = papelSchema.safeParse(papelBruto);
  if (!papel.success) return falhaValidacao(papel.error);
  const resultado = await executar(
    async () => {
      await definirPapel(getDb(), sessao.usuario, usuarioId.data, papel.data, opcoesAdmin());
      atualizarPainel();
      return sucesso(null);
    },
    { acao: "admin.definirPapelAcao", usuarioId: sessao.usuario.id },
  );
  if (resultado.ok && usuarioId.data === sessao.usuario.id && papel.data !== "ADMIN") {
    redirect("/");
  }
  return resultado;
}

/** Bloqueia ou desbloqueia o usuário (sem acesso por sessão nem pelo token do MCP). */
export async function definirBloqueioAcao(
  usuarioIdBruto: unknown,
  bloqueadoBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = idSchema.safeParse(usuarioIdBruto);
  if (!usuarioId.success) return falhaValidacao(usuarioId.error);
  const bloqueado = bloqueadoSchema.safeParse(bloqueadoBruto);
  if (!bloqueado.success) return falhaValidacao(bloqueado.error);
  return executar(
    async () => {
      await definirBloqueio(getDb(), sessao.usuario, usuarioId.data, bloqueado.data, opcoesAdmin());
      atualizarPainel();
      return sucesso(null);
    },
    { acao: "admin.definirBloqueioAcao", usuarioId: sessao.usuario.id },
  );
}

/** Libera um e-mail para entrar com Google. */
export async function adicionarEmailPermitidoAcao(emailBruto: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const email = emailSchema.safeParse(emailBruto);
  if (!email.success) return falhaValidacao(email.error);
  return executar(
    async () => {
      await adicionarEmailPermitido(getDb(), sessao.usuario, email.data);
      atualizarPainel();
      return sucesso(null);
    },
    { acao: "admin.adicionarEmailPermitidoAcao", usuarioId: sessao.usuario.id },
  );
}

/** Retira um e-mail da lista de acesso do painel. */
export async function removerEmailPermitidoAcao(emailBruto: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirAdminAcao();
  if (!sessao.ok) return sessao;
  const email = emailSchema.safeParse(emailBruto);
  if (!email.success) return falhaValidacao(email.error);
  return executar(
    async () => {
      await removerEmailPermitido(getDb(), sessao.usuario, email.data);
      atualizarPainel();
      return sucesso(null);
    },
    { acao: "admin.removerEmailPermitidoAcao", usuarioId: sessao.usuario.id },
  );
}
