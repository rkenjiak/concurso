/**
 * Usuários (#49): cadastro pelo login Google, último acesso, token do MCP e allowlist do painel
 * admin (#50).
 */
import { createHash, randomBytes } from "node:crypto";
import { and, type Column, eq, isNull, lt, or, sql } from "drizzle-orm";
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

/**
 * Registra o último acesso no login por senha. Sempre grava (sem o throttle de
 * {@link registrarAcessoSessao}): um login é raro e deve aparecer na hora no painel.
 */
export async function registrarAcesso(db: Db, id: number, agora: Date = new Date()): Promise<void> {
  await db.update(usuario).set({ ultimoAcessoEm: agora }).where(eq(usuario.id, id));
}

/**
 * Janela do throttle do registro de uso (#108): dentro dela, novos acessos não escrevem no banco
 * (uma escrita a cada 15 min por usuário e canal, no máximo).
 */
export const JANELA_REGISTRO_USO_MS = 15 * 60 * 1000;

/** `coluna` vazia ou mais antiga que `limite` (ms). */
const desatualizada = (coluna: Column, limite: number) =>
  sql`(${coluna} IS NULL OR ${coluna} < ${limite})`;

/** Novo valor de `coluna`: `agora` se estiver desatualizada; senão, mantém o atual. */
const renovada = (coluna: Column, agora: number, limite: number) =>
  sql`CASE WHEN ${desatualizada(coluna, limite)} THEN ${agora} ELSE ${coluna} END`;

/**
 * Registra o último acesso por sessão (#108): uma única escrita condicional, sem leitura prévia, que
 * só acontece se o registro anterior tiver mais de {@link JANELA_REGISTRO_USO_MS}. Devolve `true`
 * se escreveu.
 */
export async function registrarAcessoSessao(
  db: Db,
  id: number,
  agora: Date = new Date(),
): Promise<boolean> {
  const limite = new Date(agora.getTime() - JANELA_REGISTRO_USO_MS);
  const linhas = await db
    .update(usuario)
    .set({ ultimoAcessoEm: agora })
    .where(
      and(
        eq(usuario.id, id),
        or(isNull(usuario.ultimoAcessoEm), lt(usuario.ultimoAcessoEm, limite)),
      ),
    )
    .returning({ id: usuario.id });
  return linhas.length > 0;
}

/**
 * Registra o uso de um token pessoal (#108): `ultimo_acesso_em` e o `*_usado_em` do canal, cada um
 * com o throttle de {@link JANELA_REGISTRO_USO_MS}, numa única escrita condicional. Só vale para o
 * token atual (pelo resumo): uma requisição com o token antigo, concorrente com gerar/revogar, não
 * marca o novo como usado. Devolve `true` se escreveu.
 */
export async function registrarUsoToken(
  db: Db,
  id: number,
  canal: "mcp" | "ics",
  token: string,
  agora: Date = new Date(),
): Promise<boolean> {
  const ms = agora.getTime();
  const limite = ms - JANELA_REGISTRO_USO_MS;
  const hash = canal === "mcp" ? usuario.mcpTokenHash : usuario.icsTokenHash;
  const usadoEm = canal === "mcp" ? usuario.mcpTokenUsadoEm : usuario.icsTokenUsadoEm;
  const novoUso = renovada(usadoEm, ms, limite);
  const linhas = await db
    .update(usuario)
    .set({
      ultimoAcessoEm: renovada(usuario.ultimoAcessoEm, ms, limite),
      ...(canal === "mcp" ? { mcpTokenUsadoEm: novoUso } : { icsTokenUsadoEm: novoUso }),
    })
    .where(
      and(
        eq(usuario.id, id),
        eq(hash, resumoTokenMcp(token)),
        or(desatualizada(usuario.ultimoAcessoEm, limite), desatualizada(usadoEm, limite)),
      ),
    )
    .returning({ id: usuario.id });
  return linhas.length > 0;
}

/** Resumo SHA-256 (hex) de um token (MCP ou feed .ics): só ele é guardado no banco. */
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
    .set({ mcpTokenHash: resumoTokenMcp(token), mcpTokenUsadoEm: null })
    .where(eq(usuario.id, usuarioId));
  return token;
}

/** Revoga o token do MCP do usuário (e zera o último uso, #108). */
export async function revogarTokenMcp(db: Db, usuarioId: number): Promise<void> {
  await db
    .update(usuario)
    .set({ mcpTokenHash: null, mcpTokenUsadoEm: null })
    .where(eq(usuario.id, usuarioId));
}

/** Usuário dono do token do MCP, ou `null` (também se ele estiver bloqueado, #50). */
export async function usuarioDoTokenMcp(db: Db, token: string): Promise<Usuario | null> {
  const [linha] = await db
    .select()
    .from(usuario)
    .where(and(eq(usuario.mcpTokenHash, resumoTokenMcp(token)), isNull(usuario.bloqueadoEm)));
  return linha ?? null;
}

/** Prefixo dos tokens do feed de calendário (#65). */
export const PREFIXO_TOKEN_ICS = "cics_";

/**
 * Gera um novo token do feed de calendário (.ics, #65) — o anterior deixa de valer — e o devolve;
 * o banco guarda só o resumo (como no token do MCP).
 */
export async function gerarTokenIcs(db: Db, usuarioId: number): Promise<string> {
  const token = `${PREFIXO_TOKEN_ICS}${randomBytes(32).toString("base64url")}`;
  await db
    .update(usuario)
    .set({ icsTokenHash: resumoTokenMcp(token), icsTokenUsadoEm: null })
    .where(eq(usuario.id, usuarioId));
  return token;
}

/** Revoga o token do feed de calendário (e zera o último uso, #108). */
export async function revogarTokenIcs(db: Db, usuarioId: number): Promise<void> {
  await db
    .update(usuario)
    .set({ icsTokenHash: null, icsTokenUsadoEm: null })
    .where(eq(usuario.id, usuarioId));
}

/** Usuário dono do token do feed de calendário, ou `null` (também se estiver bloqueado, #50). */
export async function usuarioDoTokenIcs(db: Db, token: string): Promise<Usuario | null> {
  if (!token.startsWith(PREFIXO_TOKEN_ICS)) return null;
  const [linha] = await db
    .select()
    .from(usuario)
    .where(and(eq(usuario.icsTokenHash, resumoTokenMcp(token)), isNull(usuario.bloqueadoEm)));
  return linha ?? null;
}

export interface OpcoesFeedIcs {
  incluirConcluidos: boolean;
  incluirEncerrados: boolean;
}

/** Opções do feed de calendário (valem também para o download de todos os concursos). */
export async function definirOpcoesIcs(
  db: Db,
  usuarioId: number,
  opcoes: OpcoesFeedIcs,
): Promise<void> {
  await db
    .update(usuario)
    .set({
      icsIncluirConcluidos: opcoes.incluirConcluidos,
      icsIncluirEncerrados: opcoes.incluirEncerrados,
    })
    .where(eq(usuario.id, usuarioId));
}
