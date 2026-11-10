/**
 * Feedback de usuários (#117): o envio (qualquer usuário logado, sempre em nome de quem está na
 * sessão) e a caixa de entrada do admin. Usuário comum não lê feedback de ninguém, nem o próprio:
 * as leituras daqui só são chamadas pelo painel, que exige o papel `ADMIN`.
 *
 * Ações em lote do admin: uma transação por chamada e **um registro de auditoria por lote**, com a
 * quantidade de itens alterados no alvo ("5 feedbacks"). Lote que não altera nada não é auditado.
 */
import { and, count, desc, eq, gte, inArray, ne, type SQL, sql } from "drizzle-orm";
import type { StatusFeedback, TipoFeedback } from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import {
  FEEDBACKS_POR_PAGINA,
  JANELA_ENVIOS_MS,
  MAX_ENVIOS_FEEDBACK,
  MAX_LOTE_FEEDBACK,
  MENSAGENS_FEEDBACK,
  quantidadeFeedbacks,
} from "@/domain/feedback";
import type { FeedbackEntrada, FiltroStatusFeedback } from "@/lib/schemas/feedback";
import type { Db } from "../db/client";
import { type Feedback, feedback } from "../db/schema";
import { type AutorAdmin, auditar, rotuloUsuario } from "./admin";
import type { Executor } from "./tipos";

/** Quem envia: o usuário da sessão (nunca um ID vindo do cliente). */
export interface AutorFeedback {
  id: number;
  email: string | null;
  nome: string | null;
}

/** Dados anexados pelo servidor: build no ar (`lib/versao.ts`) e user agent do cabeçalho. */
export interface ContextoFeedback {
  versaoApp: string;
  commitApp: string;
  userAgent: string | null;
}

/**
 * Grava o feedback. Limite de {@link MAX_ENVIOS_FEEDBACK} envios por usuário em uma hora, contado
 * no banco depois da inserção, na mesma transação: no SQLite as escritas são serializadas, então
 * envios simultâneos não passam do limite.
 */
export async function criarFeedback(
  db: Db,
  autor: AutorFeedback,
  dados: FeedbackEntrada,
  contexto: ContextoFeedback,
  agora: Date = new Date(),
): Promise<number> {
  return db.transaction(async (tx) => {
    const [linha] = await tx
      .insert(feedback)
      .values({
        usuarioId: autor.id,
        usuario: rotuloUsuario(autor),
        tipo: dados.tipo,
        mensagem: dados.mensagem,
        pagina: dados.pagina,
        versaoApp: contexto.versaoApp,
        commitApp: contexto.commitApp,
        userAgent: contexto.userAgent,
        createdAt: agora,
      })
      .returning({ id: feedback.id });
    if (!linha) throw new Error("Falha ao gravar o feedback.");
    const [janela] = await tx
      .select({ n: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.usuarioId, autor.id),
          gte(feedback.createdAt, new Date(agora.getTime() - JANELA_ENVIOS_MS)),
        ),
      );
    if ((janela?.n ?? 0) > MAX_ENVIOS_FEEDBACK) {
      throw new ErroDominio(MENSAGENS_FEEDBACK.limiteEnvios);
    }
    return linha.id;
  });
}

// --- Leituras (só painel admin) ----------------------------------------------------------------

export interface FiltrosFeedback {
  status?: FiltroStatusFeedback;
  tipo?: TipoFeedback | null;
  /** Texto na mensagem (sem distinção de maiúsculas). */
  busca?: string | null;
  /** 1 = primeira. */
  pagina?: number;
  porPagina?: number;
}

export interface PaginaFeedbacks {
  itens: Feedback[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

/** Escapa `%`, `_` e `\` para o `LIKE ... ESCAPE '\'`. */
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Caixa de entrada: mais recentes primeiro, filtrada e paginada. Padrão: só os novos. */
export async function listarFeedbacks(
  db: Executor,
  filtros: FiltrosFeedback = {},
): Promise<PaginaFeedbacks> {
  const porPagina = filtros.porPagina ?? FEEDBACKS_POR_PAGINA;
  const condicoes: (SQL | undefined)[] = [];
  const status = filtros.status ?? "NOVO";
  if (status !== "TODOS") condicoes.push(eq(feedback.status, status));
  if (filtros.tipo) condicoes.push(eq(feedback.tipo, filtros.tipo));
  const busca = filtros.busca?.trim();
  if (busca) {
    condicoes.push(
      sql`lower(${feedback.mensagem}) like ${`%${escaparLike(busca.toLowerCase())}%`} escape '\\'`,
    );
  }
  const onde = and(...condicoes);
  const [contagem] = await db.select({ n: count() }).from(feedback).where(onde);
  const total = contagem?.n ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, Math.trunc(filtros.pagina ?? 1)), totalPaginas);
  const itens = await db
    .select()
    .from(feedback)
    .where(onde)
    .orderBy(desc(feedback.createdAt), desc(feedback.id))
    .limit(porPagina)
    .offset((pagina - 1) * porPagina);
  return { itens, total, pagina, totalPaginas };
}

/** Feedbacks ainda não tratados (contador da navegação e card da visão geral). */
export async function contarFeedbacksNovos(db: Executor): Promise<number> {
  const [linha] = await db.select({ n: count() }).from(feedback).where(eq(feedback.status, "NOVO"));
  return linha?.n ?? 0;
}

// --- Ações em lote (admin) ---------------------------------------------------------------------

function conferirLote(itens: readonly unknown[]): void {
  if (itens.length > MAX_LOTE_FEEDBACK) {
    throw new ErroDominio(`Selecione no máximo ${MAX_LOTE_FEEDBACK} feedbacks por vez.`);
  }
}

/**
 * Marca como `EXPORTADO` (com quem e quando) e devolve os itens, na ordem da caixa de entrada.
 * Exportar de novo um item já exportado é permitido (regera o texto). Descartados ficam de fora:
 * não voltam a `EXPORTADO` nem entram no conteúdo (restaure-os antes).
 */
export async function exportarFeedbacks(
  db: Db,
  autor: AdminFeedback,
  ids: readonly number[],
  agora: Date = new Date(),
): Promise<Feedback[]> {
  conferirLote(ids);
  if (ids.length === 0) return [];
  return db.transaction(async (tx) => {
    const itens = await tx
      .update(feedback)
      .set({ status: "EXPORTADO", tratadoPor: autor.id, tratadoEm: agora })
      .where(and(inArray(feedback.id, [...ids]), ne(feedback.status, "DESCARTADO")))
      .returning();
    if (itens.length > 0) {
      await auditar(tx, autor, "EXPORTAR_FEEDBACK", quantidadeFeedbacks(itens.length), null, agora);
    }
    return itens.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
  });
}

export type AdminFeedback = AutorAdmin;

/** Status de cada item antes do descarte, para o "Desfazer". */
export interface StatusAnterior {
  id: number;
  status: Exclude<StatusFeedback, "DESCARTADO">;
}

/** Descarta (sem apagar). Devolve o status anterior dos que mudaram; já descartados ficam iguais. */
export async function descartarFeedbacks(
  db: Db,
  autor: AdminFeedback,
  ids: readonly number[],
  agora: Date = new Date(),
): Promise<StatusAnterior[]> {
  conferirLote(ids);
  if (ids.length === 0) return [];
  return db.transaction(async (tx) => {
    const antes = await tx
      .select({ id: feedback.id, status: feedback.status })
      .from(feedback)
      .where(and(inArray(feedback.id, [...ids]), ne(feedback.status, "DESCARTADO")));
    if (antes.length === 0) return [];
    await tx
      .update(feedback)
      .set({ status: "DESCARTADO", tratadoPor: autor.id, tratadoEm: agora })
      .where(
        inArray(
          feedback.id,
          antes.map((a) => a.id),
        ),
      );
    await auditar(tx, autor, "DESCARTAR_FEEDBACK", quantidadeFeedbacks(antes.length), null, agora);
    return antes as StatusAnterior[];
  });
}

/**
 * Tira itens de `DESCARTADO`: para `NOVO` (restaurar, na aba Descartados) ou para o status que
 * cada um tinha (desfazer o descarte). Itens que não estão descartados ficam como estão.
 */
export async function restaurarFeedbacks(
  db: Db,
  autor: AdminFeedback,
  itens: readonly StatusAnterior[],
  agora: Date = new Date(),
): Promise<number> {
  conferirLote(itens);
  if (itens.length === 0) return 0;
  return db.transaction(async (tx) => {
    let alterados = 0;
    for (const status of ["NOVO", "EXPORTADO"] as const) {
      const ids = itens.filter((i) => i.status === status).map((i) => i.id);
      if (ids.length === 0) continue;
      const linhas = await tx
        .update(feedback)
        .set({ status, tratadoPor: autor.id, tratadoEm: agora })
        .where(and(inArray(feedback.id, ids), eq(feedback.status, "DESCARTADO")))
        .returning({ id: feedback.id });
      alterados += linhas.length;
    }
    if (alterados > 0) {
      await auditar(tx, autor, "RESTAURAR_FEEDBACK", quantidadeFeedbacks(alterados), null, agora);
    }
    return alterados;
  });
}

/** Exclui definitivamente. Só itens descartados: os demais são ignorados. */
export async function excluirFeedbacks(
  db: Db,
  autor: AdminFeedback,
  ids: readonly number[],
  agora: Date = new Date(),
): Promise<number> {
  conferirLote(ids);
  if (ids.length === 0) return 0;
  return db.transaction(async (tx) => {
    const linhas = await tx
      .delete(feedback)
      .where(and(inArray(feedback.id, [...ids]), eq(feedback.status, "DESCARTADO")))
      .returning({ id: feedback.id });
    if (linhas.length > 0) {
      await auditar(tx, autor, "EXCLUIR_FEEDBACK", quantidadeFeedbacks(linhas.length), null, agora);
    }
    return linhas.length;
  });
}
