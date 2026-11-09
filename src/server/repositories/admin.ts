/**
 * Painel administrativo (#50): usuários, papéis, bloqueio, allowlist do login Google e auditoria.
 * Toda alteração grava um registro em `auditoria_admin` na mesma transação.
 *
 * Invariante: sempre resta pelo menos um admin ativo (papel `ADMIN` e não bloqueado). Rebaixar ou
 * bloquear um admin só acontece se existir outro admin ativo, conferido no próprio `UPDATE` (sem
 * janela entre a contagem e a escrita). Admins de `ADMIN_EMAILS` são garantidos pela configuração
 * e não podem ser rebaixados nem bloqueados pelo painel.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
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
  link,
  resultadoFase,
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

/** Nome para exibir no painel: o nome, ou "Usuário inicial"/"Sem nome" (#108). */
export function nomeUsuario(u: { nome: string | null; email: string | null }) {
  return u.nome ?? (u.email === null ? "Usuário inicial" : "Sem nome");
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

/**
 * `true` se o e-mail está em `ADMIN_EMAILS` (`fixos`, já normalizados). Normaliza o e-mail por
 * coerência com {@link normalizarEmail}, embora o banco já o guarde normalizado (#108).
 */
export function ehEmailAdminFixo(email: string | null, fixos: ReadonlySet<string>): boolean {
  return email !== null && fixos.has(normalizarEmail(email));
}

const ehAdminFixo = (alvo: Usuario, opcoes: OpcoesAdmin) =>
  ehEmailAdminFixo(alvo.email, opcoes.emailsAdminFixos);

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
  /** Token do MCP ativo (#108): só a flag, nunca o resumo. */
  mcpTokenAtivo: boolean;
  mcpTokenUsadoEm: Date | null;
  /** Feed .ics ativo (#108). */
  icsTokenAtivo: boolean;
  icsTokenUsadoEm: Date | null;
  /** E-mail liberado no painel (`email_permitido`, #108): entra no cálculo do "sem acesso hoje". */
  emailNoPainel: boolean;
}

/**
 * Colunas do usuário que o painel pode ver (#108): flags, datas técnicas e o necessário para a
 * regra de acesso. Os resumos dos tokens só saem daqui convertidos em flag ({@link semSegredos}).
 */
const colunasUsuario = {
  id: usuario.id,
  email: usuario.email,
  nome: usuario.nome,
  avatarUrl: usuario.avatarUrl,
  papel: usuario.papel,
  bloqueadoEm: usuario.bloqueadoEm,
  ultimoAcessoEm: usuario.ultimoAcessoEm,
  createdAt: usuario.createdAt,
  mcpTokenHash: usuario.mcpTokenHash,
  mcpTokenUsadoEm: usuario.mcpTokenUsadoEm,
  icsTokenHash: usuario.icsTokenHash,
  icsTokenUsadoEm: usuario.icsTokenUsadoEm,
  emailNoPainel: emailPermitido.email,
};

/**
 * `LEFT JOIN` com a allowlist do painel pela igualdade exata do e-mail (#108). Vale porque os dois
 * lados são gravados normalizados: `usuario.email` só vem do login Google (`lerPerfil` aplica
 * `normalizarEmail`) e `email_permitido.email` passa por `normalizarEmail` ao ser liberado — a
 * mesma regra de `emailNaAllowlist`. Assim o índice da chave primária continua sendo usado.
 */
const comAllowlistDoPainel = eq(emailPermitido.email, usuario.email);

/** Troca os resumos dos tokens e o e-mail da allowlist por flags. */
function semSegredos<
  T extends { mcpTokenHash: string | null; icsTokenHash: string | null; emailNoPainel: unknown },
>({ mcpTokenHash, icsTokenHash, emailNoPainel, ...u }: T) {
  return {
    ...u,
    mcpTokenAtivo: mcpTokenHash !== null,
    icsTokenAtivo: icsTokenHash !== null,
    emailNoPainel: emailNoPainel !== null,
  };
}

/**
 * Usuários com o número de concursos de cada um e o uso dos tokens (#108), do mais antigo ao mais
 * novo.
 */
export async function listarUsuarios(db: Executor): Promise<UsuarioAdmin[]> {
  const linhas = await db
    .select({ ...colunasUsuario, totalConcursos: count(concurso.id) })
    .from(usuario)
    .leftJoin(emailPermitido, comAllowlistDoPainel)
    .leftJoin(concurso, eq(concurso.usuarioId, usuario.id))
    .groupBy(usuario.id)
    .orderBy(asc(usuario.createdAt), asc(usuario.id));
  return linhas.map(semSegredos);
}

export interface DetalheUsuarioAdmin extends Omit<UsuarioAdmin, "totalConcursos"> {
  /** Conta Google vinculada (`google_sub` preenchido); o `sub` em si não sai daqui. */
  googleVinculado: boolean;
  /** Só contagens agregadas: nada do conteúdo dos concursos (#108). */
  contagens: { concursos: number; eventos: number; links: number; resultados: number };
}

/** Detalhe de um usuário para o painel (#108), ou `null` se não existir. */
export async function obterDetalheUsuario(
  db: Executor,
  id: number,
): Promise<DetalheUsuarioAdmin | null> {
  const total = async (consulta: Promise<{ n: number }[]>) => (await consulta)[0]?.n ?? 0;
  const doUsuario = eq(concurso.usuarioId, id);
  const [[linha], concursos, eventos, links, resultados] = await Promise.all([
    db
      .select({ ...colunasUsuario, googleSub: usuario.googleSub })
      .from(usuario)
      .leftJoin(emailPermitido, comAllowlistDoPainel)
      .where(eq(usuario.id, id)),
    total(db.select({ n: count() }).from(concurso).where(doUsuario)),
    total(
      db
        .select({ n: count() })
        .from(evento)
        .innerJoin(concurso, eq(concurso.id, evento.concursoId))
        .where(doUsuario),
    ),
    total(
      db
        .select({ n: count() })
        .from(link)
        .innerJoin(concurso, eq(concurso.id, link.concursoId))
        .where(doUsuario),
    ),
    total(
      db
        .select({ n: count() })
        .from(resultadoFase)
        .innerJoin(concurso, eq(concurso.id, resultadoFase.concursoId))
        .where(doUsuario),
    ),
  ]);
  if (!linha) return null;
  const { googleSub, ...resto } = linha;
  return {
    ...semSegredos(resto),
    googleVinculado: googleSub !== null,
    contagens: { concursos, eventos, links, resultados },
  };
}

export interface ResumoInstancia {
  usuarios: number;
  admins: number;
  bloqueados: number;
  concursos: number;
  eventos: number;
  emailsPermitidos: number;
  /** Usuários não bloqueados com acesso nos últimos 7 e 30 dias (#108). */
  ativos7Dias: number;
  ativos30Dias: number;
  /** Usuários não bloqueados com token do MCP / feed .ics ativo (#108). */
  comTokenMcp: number;
  comFeedIcs: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Totais da instância para a visão geral do painel (só contagens, nada de conteúdo). */
export async function obterResumo(
  db: Executor,
  agora: Date = new Date(),
): Promise<ResumoInstancia> {
  const total = async (consulta: Promise<{ n: number }[]>) => (await consulta)[0]?.n ?? 0;
  const contar = (condicao: SQL | undefined) =>
    total(db.select({ n: count() }).from(usuario).where(condicao));
  const desde = (dias: number) => new Date(agora.getTime() - dias * DIA_MS);
  const [
    usuarios,
    admins,
    bloqueados,
    concursos,
    eventos,
    emailsPermitidos,
    ativos7Dias,
    ativos30Dias,
    comTokenMcp,
    comFeedIcs,
  ] = await Promise.all([
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
    contar(and(gte(usuario.ultimoAcessoEm, desde(7)), isNull(usuario.bloqueadoEm))),
    contar(and(gte(usuario.ultimoAcessoEm, desde(30)), isNull(usuario.bloqueadoEm))),
    contar(and(isNotNull(usuario.mcpTokenHash), isNull(usuario.bloqueadoEm))),
    contar(and(isNotNull(usuario.icsTokenHash), isNull(usuario.bloqueadoEm))),
  ]);
  return {
    usuarios,
    admins,
    bloqueados,
    concursos,
    eventos,
    emailsPermitidos,
    ativos7Dias,
    ativos30Dias,
    comTokenMcp,
    comFeedIcs,
  };
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

/** Tokens pessoais apagados, com o último uso de cada um (#96, #108). */
const TOKENS_ZERADOS = {
  mcpTokenHash: null,
  icsTokenHash: null,
  mcpTokenUsadoEm: null,
  icsTokenUsadoEm: null,
} as const;

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
        .set({ bloqueadoEm: agora, ...TOKENS_ZERADOS })
        .where(condicao)
        .returning({ id: usuario.id });
      if (linhas.length === 0) throw new ErroDominio(MENSAGENS_ADMIN.ultimoAdmin);
    } else {
      // Limpa os tokens também aqui: quem foi bloqueado antes do #96 ainda os tinha guardados.
      await tx
        .update(usuario)
        .set({ bloqueadoEm: null, ...TOKENS_ZERADOS })
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

/**
 * Revoga os tokens pessoais (MCP e feed .ics) do usuário sem bloqueá-lo (#108), zerando também o
 * último uso. Sem nenhum token ativo, não faz nada nem audita (como as demais ações sem mudança).
 * Devolve `true` se revogou algo.
 */
export async function revogarTokens(
  db: Db,
  autor: AutorAdmin,
  alvoId: number,
  agora: Date = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const alvo = await obterAlvo(tx, alvoId);
    const linhas = await tx
      .update(usuario)
      .set(TOKENS_ZERADOS)
      .where(
        and(
          eq(usuario.id, alvo.id),
          or(isNotNull(usuario.mcpTokenHash), isNotNull(usuario.icsTokenHash)),
        ),
      )
      .returning({ id: usuario.id });
    if (linhas.length === 0) return false;
    await auditar(tx, autor, "REVOGAR_TOKENS", rotuloUsuario(alvo), alvo.id, agora);
    return true;
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
