"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuarioAcao } from "../auth/acesso";
import { MENSAGEM_SEM_PERMISSAO } from "../auth/admin";
import { COOKIE_VISAO, opcoesCookieVisao, VISOES } from "../auth/visao";
import { falha, falhaValidacao, type ResultadoAcao } from "./resultado";

const visaoSchema = z.enum(VISOES, { error: "Visão inválida." });

/**
 * Alterna entre a visão admin e a visão usuário (#50), sem novo login: grava a escolha em cookie e
 * leva ao início da visão (`/admin` ou `/`). Só admins podem escolher a visão admin.
 */
export async function alternarVisaoAcao(visaoBruta: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const visao = visaoSchema.safeParse(visaoBruta);
  if (!visao.success) return falhaValidacao(visao.error);
  if (visao.data === "admin" && sessao.usuario.papel !== "ADMIN") {
    return falha(MENSAGEM_SEM_PERMISSAO);
  }
  (await cookies()).set(
    COOKIE_VISAO,
    visao.data,
    opcoesCookieVisao(process.env.NODE_ENV === "production"),
  );
  redirect(visao.data === "admin" ? "/admin" : "/");
}
