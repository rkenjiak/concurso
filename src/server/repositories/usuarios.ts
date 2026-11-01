/**
 * Usuários (#49): cadastro pelo login Google, último acesso, token do MCP e allowlist do painel
 * admin (#50).
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "../db/client";
import { emailPermitido, ID_USUARIO_INICIAL, type Usuario, usuario } from "../db/schema";
import type { Executor } from "./tipos";

export interface PerfilLogin {
  sub: string;
  email: string;
  nome: string | null;
  avatarUrl: string | null;
}

export async function obterUsuario(db: Executor, id: number): Promise<Usuario | null> {
  const [linha] = await db.select().from(usuario).where(eq(usuario.id, id));
  return linha ?? null;
}

/** Usuário já cadastrado para o login Google: pela conta (`sub`) ou, sem ela, pelo e-mail. */
export async function buscarUsuarioGoogle(
  db: Executor,
  sub: string,
  email: string,
): Promise<Usuario | null> {
  const linhas = await db
    .select()
    .from(usuario)
    .where(or(eq(usuario.googleSub, sub), eq(usuario.email, email)));
  return linhas.find((u) => u.googleSub === sub) ?? linhas[0] ?? null;
}

/** `true` se o e-mail (já normalizado) foi liberado pelo painel admin (#50). */
export async function emailNaAllowlist(db: Executor, email: string): Promise<boolean> {
  const [linha] = await db
    .select({ email: emailPermitido.email })
    .from(emailPermitido)
    .where(eq(emailPermitido.email, email));
  return linha !== undefined;
}

/**
 * Encontra ou cria o usuário de um login Google já autorizado (e-mail na allowlist), na ordem:
 * mesma conta Google (`sub`); mesmo e-mail (vincula a conta); para um admin, o usuário inicial
 * ainda não assumido (herda os dados anteriores ao multiusuário); senão, um usuário novo.
 * Atualiza nome, foto e último acesso; quem está em `ADMIN_EMAILS` vira admin.
 */
export async function entrarComGoogle(
  db: Db,
  perfil: PerfilLogin,
  ehAdmin: boolean,
  agora: Date = new Date(),
): Promise<Usuario> {
  return db.transaction(async (tx) => {
    const dados = {
      googleSub: perfil.sub,
      email: perfil.email,
      nome: perfil.nome,
      avatarUrl: perfil.avatarUrl,
      ultimoAcessoEm: agora,
      ...(ehAdmin ? { papel: "ADMIN" as const } : {}),
    };
    const [porSub] = await tx.select().from(usuario).where(eq(usuario.googleSub, perfil.sub));
    const [porEmail] = porSub
      ? []
      : await tx.select().from(usuario).where(eq(usuario.email, perfil.email));
    const alvo =
      porSub ??
      porEmail ??
      (ehAdmin
        ? (
            await tx
              .select()
              .from(usuario)
              .where(
                and(
                  eq(usuario.id, ID_USUARIO_INICIAL),
                  isNull(usuario.email),
                  isNull(usuario.googleSub),
                ),
              )
          )[0]
        : undefined);

    if (alvo) {
      const [atualizado] = await tx
        .update(usuario)
        .set(dados)
        .where(eq(usuario.id, alvo.id))
        .returning();
      if (!atualizado) throw new Error("Falha ao atualizar o usuário.");
      return atualizado;
    }
    const [novo] = await tx.insert(usuario).values(dados).returning();
    if (!novo) throw new Error("Falha ao cadastrar o usuário.");
    return novo;
  });
}

/** Registra o último acesso (login por senha). */
export async function registrarAcesso(db: Db, id: number, agora: Date = new Date()): Promise<void> {
  await db.update(usuario).set({ ultimoAcessoEm: agora }).where(eq(usuario.id, id));
}

/** Resumo SHA-256 (hex) do token do MCP: só ele é guardado no banco. */
export function resumoTokenMcp(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Prefixo dos tokens do MCP (identifica a origem em configurações de clientes e logs). */
export const PREFIXO_TOKEN_MCP = "cmcp_";

/**
 * Gera um novo token do MCP para o usuário (o anterior deixa de valer) e o devolve — é a única
 * vez em que ele aparece; o banco guarda só o resumo.
 */
export async function gerarTokenMcp(db: Db, usuarioId: number): Promise<string> {
  const token = `${PREFIXO_TOKEN_MCP}${randomBytes(32).toString("base64url")}`;
  await db
    .update(usuario)
    .set({ mcpTokenHash: resumoTokenMcp(token) })
    .where(eq(usuario.id, usuarioId));
  return token;
}

/** Revoga o token do MCP do usuário. */
export async function revogarTokenMcp(db: Db, usuarioId: number): Promise<void> {
  await db.update(usuario).set({ mcpTokenHash: null }).where(eq(usuario.id, usuarioId));
}

/** Usuário dono do token do MCP, ou `null` (também se ele estiver bloqueado, #50). */
export async function usuarioDoTokenMcp(db: Db, token: string): Promise<Usuario | null> {
  const [linha] = await db
    .select()
    .from(usuario)
    .where(and(eq(usuario.mcpTokenHash, resumoTokenMcp(token)), isNull(usuario.bloqueadoEm)));
  return linha ?? null;
}
