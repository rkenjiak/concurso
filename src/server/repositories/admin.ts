/**
 * Painel administrativo (#50): usuários, papéis, bloqueio, allowlist do login Google e auditoria.
 * Toda alteração grava um registro em `auditoria_admin` na mesma transação.
 *
 * Invariante: sempre resta pelo menos um admin ativo (papel `ADMIN` e não bloqueado). Rebaixar ou
 * bloquear um admin só acontece se existir outro admin ativo, conferido no próprio `UPDATE` (sem
 * janela entre a contagem e a escrita). Admins de `ADMIN_EMAILS` são garantidos pela configuração
 * e não podem ser rebaixados nem bloqueados pelo painel.
 */
import { and, asc, count, desc, eq, exists, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { AcaoAdmin, Papel } from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import { normalizarEmail } from "../auth/config";
import type { Db } from "../db/client";
import {
  type AuditoriaAdmin,
  auditoriaAdmin,
  concurso,
  emailPermitido,
  evento,
  type Usuario,
  usuario,
} from "../db/schema";
import type { Executor } from "./tipos";

/** Admin que executa a ação (registrado na auditoria). */
export interface AutorAdmin {
  id: number;
  email: string | null;
  nome: string | null;
}

/** Regras vindas da configuração. */
export interface OpcoesAdmin {
  /** E-mails de `ADMIN_EMAILS` (minúsculos): admins garantidos. */
  emailsAdminFixos: ReadonlySet<string>;
}

export const MENSAGENS_ADMIN = {
  usuarioNaoEncontrado: "Usuário não encontrado.",
  ultimoAdmin:
    "Não é possível: este é o último admin ativo. Promova outro usuário a admin antes de continuar.",
  adminFixo:
    "Este admin é definido em ADMIN_EMAILS. Para rebaixá-lo ou bloqueá-lo, retire o e-mail da variável.",
  bloquearSiMesmo: "Você não pode bloquear a própria conta.",
  promoverBloqueado: "Desbloqueie o usuário antes de promovê-lo a admin.",
  emailRepetido: "Este e-mail já está na lista de acesso.",
  emailAusente: "Este e-mail não está na lista de acesso.",
} as const;

/** Identificação legível de um usuário (e-mail, nome ou ID). */
export function rotuloUsuario(u: { id: number; email: string | null; nome: string | null }) {
  return u.email ?? u.nome ?? `Usuário #${u.id}`;
}

async function auditar(
  tx: Executor,
  autor: AutorAdmin,
  acao: AcaoAdmin,
  alvo: string,
  alvoUsuarioId: number | null = null,
  agora: Date = new Date(),
): Promise<void> {
  await tx.insert(auditoriaAdmin).values({
    adminId: autor.id,
    admin: rotuloUsuario(autor),
    acao,
    alvoUsuarioId,
    alvo,
    createdAt: agora,
  });
}

async function obterAlvo(tx: Executor, id: number): Promise<Usuario> {
  const [alvo] = await tx.select().from(usuario).where(eq(usuario.id, id));
  if (!alvo) throw new ErroDominio(MENSAGENS_ADMIN.usuarioNaoEncontrado);
  return alvo;
}

/** Condição: existe outro admin ativo além de `id` (para não deixar a instância sem admin). */
function existeOutroAdminAtivo(tx: Executor, id: number) {
  const outro = alias(usuario, "outro_admin");
  return exists(
    tx
      .select({ um: sql`1` })
      .from(outro)
      .where(and(eq(outro.papel, "ADMIN"), isNull(outro.bloqueadoEm), ne(outro.id, id))),
  );
}

const ehAdminFixo = (alvo: Usuario, opcoes: OpcoesAdmin) =>
  alvo.email !== null && opcoes.emailsAdminFixos.has(alvo.email);

// --- Leituras ---------------------------------------------------------------------------------

export interface UsuarioAdmin {
  id: number;
  email: string | null;
  nome: string | null;
  avatarUrl: string | null;
  papel: Papel;
  bloqueadoEm: Date | null;
  ultimoAcessoEm: Date | null;
  createdAt: Date;
  totalConcursos: number;
}

/** Usuários com o número de concursos de cada um, do mais antigo ao mais novo. */
export async function listarUsuarios(db: Executor): Promise<UsuarioAdmin[]> {
  return db
    .select({
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      avatarUrl: usuario.avatarUrl,
      papel: usuario.papel,
      bloqueadoEm: usuario.bloqueadoEm,
      ultimoAcessoEm: usuario.ultimoAcessoEm,
      createdAt: usuario.createdAt,
      totalConcursos: count(concurso.id),
    })
    .from(usuario)
    .leftJoin(concurso, eq(concurso.usuarioId, usuario.id))
    .groupBy(usuario.id)
    .orderBy(asc(usuario.createdAt), asc(usuario.id));
}

export interface ResumoInstancia {
  usuarios: number;
  admins: number;
  bloqueados: number;
  concursos: number;
  eventos: number;
  emailsPermitidos: number;
}

/** Totais da instância para a visão geral do painel. */
export async function obterResumo(db: Executor): Promise<ResumoInstancia> {
  const total = async (consulta: Promise<{ n: number }[]>) => (await consulta)[0]?.n ?? 0;
  const [usuarios, admins, bloqueados, concursos, eventos, emailsPermitidos] = await Promise.all([
    total(db.select({ n: count() }).from(usuario)),
    total(
      db
        .select({ n: count() })
        .from(usuario)
        .where(and(eq(usuario.papel, "ADMIN"), isNull(usuario.bloqueadoEm))),
    ),
    total(db.select({ n: count() }).from(usuario).where(isNotNull(usuario.bloqueadoEm))),
    total(db.select({ n: count() }).from(concurso)),
    total(db.select({ n: count() }).from(evento)),
    total(db.select({ n: count() }).from(emailPermitido)),
  ]);
  return { usuarios, admins, bloqueados, concursos, eventos, emailsPermitidos };
}

export interface EmailPermitidoAdmin {
  email: string;
  adicionadoPor: string | null;
  createdAt: Date;
}

/** E-mails liberados pelo painel, em ordem alfabética. */
export async function listarEmailsPermitidos(db: Executor): Promise<EmailPermitidoAdmin[]> {
  const linhas = await db
    .select({
      email: emailPermitido.email,
      createdAt: emailPermitido.createdAt,
      autorId: usuario.id,
      autorEmail: usuario.email,
      autorNome: usuario.nome,
    })
    .from(emailPermitido)
    .leftJoin(usuario, eq(usuario.id, emailPermitido.adicionadoPor))
    .orderBy(asc(emailPermitido.email));
  return linhas.map((l) => ({
    email: l.email,
    createdAt: l.createdAt,
    adicionadoPor:
      l.autorId === null
        ? null
        : rotuloUsuario({ id: l.autorId, email: l.autorEmail, nome: l.autorNome }),
  }));
}

/** Registros de auditoria, do mais recente ao mais antigo. */
export async function listarAuditoria(db: Executor, limite = 200): Promise<AuditoriaAdmin[]> {
  return db
    .select()
    .from(auditoriaAdmin)
    .orderBy(desc(auditoriaAdmin.createdAt), desc(auditoriaAdmin.id))
    .limit(limite);
}

// --- Alterações -------------------------------------------------------------------------------

/** Promove a admin ou rebaixa a usuário comum. Sem mudança, não faz nada (nem audita). */
export async function definirPapel(
  db: Db,
  autor: AutorAdmin,
  alvoId: number,
  papel: Papel,
  opcoes: OpcoesAdmin,
  agora: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const alvo = await obterAlvo(tx, alvoId);
    if (alvo.papel === papel) return;
    if (papel === "ADMIN") {
      if (alvo.bloqueadoEm !== null) throw new ErroDominio(MENSAGENS_ADMIN.promoverBloqueado);
      await tx.update(usuario).set({ papel }).where(eq(usuario.id, alvo.id));
    } else {
      if (ehAdminFixo(alvo, opcoes)) throw new ErroDominio(MENSAGENS_ADMIN.adminFixo);
      const linhas = await tx
        .update(usuario)
        .set({ papel })
        .where(and(eq(usuario.id, alvo.id), existeOutroAdminAtivo(tx, alvo.id)))
        .returning({ id: usuario.id });
      if (linhas.length === 0) throw new ErroDominio(MENSAGENS_ADMIN.ultimoAdmin);
    }
    await auditar(
      tx,
      autor,
      papel === "ADMIN" ? "PROMOVER_ADMIN" : "REBAIXAR_ADMIN",
      rotuloUsuario(alvo),
      alvo.id,
      agora,
    );
  });
}

/**
 * Bloqueia ou desbloqueia o usuário. Bloqueado, ele perde o acesso na hora: a sessão é relida do
 * banco a cada requisição e os tokens pessoais (MCP e feed .ics) são apagados (#96) — ao ser
 * desbloqueado, ele precisa gerar outros em Configurações.
 */
export async function definirBloqueio(
  db: Db,
  autor: AutorAdmin,
  alvoId: number,
  bloqueado: boolean,
  opcoes: OpcoesAdmin,
  agora: Date = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const alvo = await obterAlvo(tx, alvoId);
    if ((alvo.bloqueadoEm !== null) === bloqueado) return;
    if (bloqueado) {
      if (alvo.id === autor.id) throw new ErroDominio(MENSAGENS_ADMIN.bloquearSiMesmo);
      if (ehAdminFixo(alvo, opcoes)) throw new ErroDominio(MENSAGENS_ADMIN.adminFixo);
      const condicao =
        alvo.papel === "ADMIN"
          ? and(eq(usuario.id, alvo.id), existeOutroAdminAtivo(tx, alvo.id))
          : eq(usuario.id, alvo.id);
      const linhas = await tx
        .update(usuario)
        // Revoga também os tokens pessoais (MCP e feed .ics, #96): desbloquear não os devolve.
        .set({ bloqueadoEm: agora, mcpTokenHash: null, icsTokenHash: null })
        .where(condicao)
        .returning({ id: usuario.id });
      if (linhas.length === 0) throw new ErroDominio(MENSAGENS_ADMIN.ultimoAdmin);
    } else {
      // Limpa os tokens também aqui: quem foi bloqueado antes do #96 ainda os tinha guardados.
      await tx
        .update(usuario)
        .set({ bloqueadoEm: null, mcpTokenHash: null, icsTokenHash: null })
        .where(eq(usuario.id, alvo.id));
    }
    await auditar(
      tx,
      autor,
      bloqueado ? "BLOQUEAR_USUARIO" : "DESBLOQUEAR_USUARIO",
      rotuloUsuario(alvo),
      alvo.id,
      agora,
    );
  });
}

/** Libera um e-mail para entrar com Google (allowlist do painel). */
export async function adicionarEmailPermitido(
  db: Db,
  autor: AutorAdmin,
  email: string,
  agora: Date = new Date(),
): Promise<void> {
  const e = normalizarEmail(email);
  await db.transaction(async (tx) => {
    const linhas = await tx
      .insert(emailPermitido)
      .values({ email: e, adicionadoPor: autor.id, createdAt: agora })
      .onConflictDoNothing()
      .returning({ email: emailPermitido.email });
    if (linhas.length === 0) throw new ErroDominio(MENSAGENS_ADMIN.emailRepetido);
    await auditar(tx, autor, "PERMITIR_EMAIL", e, null, agora);
  });
}

/**
 * Retira um e-mail da allowlist do painel. Quem só tinha acesso por ela perde o acesso na próxima
 * requisição (admins continuam entrando: o papel já dá acesso).
 */
export async function removerEmailPermitido(
  db: Db,
  autor: AutorAdmin,
  email: string,
  agora: Date = new Date(),
): Promise<void> {
  const e = normalizarEmail(email);
  await db.transaction(async (tx) => {
    const linhas = await tx
      .delete(emailPermitido)
      .where(eq(emailPermitido.email, e))
      .returning({ email: emailPermitido.email });
    if (linhas.length === 0) throw new ErroDominio(MENSAGENS_ADMIN.emailAusente);
    await auditar(tx, autor, "REMOVER_EMAIL", e, null, agora);
  });
}
