/**
 * Visão do app para admins (#50): "admin" (painel em `/admin`) ou "usuario" (o app comum, igual ao
 * de qualquer usuário). É só preferência de navegação, guardada em cookie: a autorização vem
 * sempre do papel no banco, nunca da visão escolhida. Sem dependências do Next.
 */
import type { Papel } from "@/domain/enums";

export const COOKIE_VISAO = "concurso_visao";
export const VISOES = ["usuario", "admin"] as const;
export type Visao = (typeof VISOES)[number];

/** Visão em vigor: "admin" só para quem tem o papel e a escolheu; senão "usuario". */
export function visaoEfetiva(valorCookie: string | undefined, papel: Papel): Visao {
  return papel === "ADMIN" && valorCookie === "admin" ? "admin" : "usuario";
}

/** Cookie da visão: 1 ano, `httpOnly`, `SameSite=Lax`, `secure` em produção. */
export function opcoesCookieVisao(producao: boolean) {
  return {
    httpOnly: true,
    secure: producao,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  } as const;
}
