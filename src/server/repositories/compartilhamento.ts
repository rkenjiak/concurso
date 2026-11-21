/**
 * Escritas e leitura privada de compartilhamento público de concursos (#129).
 *
 * O token é gerado com 192 bits aleatórios (`base64url`, 32 caracteres) e guardado em texto plano:
 * quem acessa o banco já vê os mesmos dados exibidos pelo link, e guardar em texto plano permite
 * ao dono copiar o link de novo e invalidar exatamente `/compartilhado/<token>` ao revogar ou
 * regenerar.
 */
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { compartilhamentoConcurso, concurso } from "../db/schema";
import { exigirConcurso } from "./eventos";
import type { Executor } from "./tipos";

export interface CompartilhamentoAtivo {
  token: string;
  createdAt: Date;
}

/** Gera um token opaco de 192 bits em `base64url` (32 caracteres). */
export function gerarTokenCompartilhamento(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Link de compartilhamento ativo do concurso, conferindo o dono (#49). Retorna `null` se o
 * concurso não estiver compartilhado ou pertencer a outro usuário.
 */
export async function obterCompartilhamentoDoConcurso(
  db: Executor,
  usuarioId: number,
  concursoId: number,
): Promise<CompartilhamentoAtivo | null> {
  const [linha] = await db
    .select({
      token: compartilhamentoConcurso.token,
      createdAt: compartilhamentoConcurso.createdAt,
    })
    .from(compartilhamentoConcurso)
    .innerJoin(concurso, eq(concurso.id, compartilhamentoConcurso.concursoId))
    .where(
      and(eq(compartilhamentoConcurso.concursoId, concursoId), eq(concurso.usuarioId, usuarioId)),
    )
    .limit(1);
  return linha ?? null;
}

/**
 * Ativa o compartilhamento do concurso. Idempotente: se já houver um link ativo, devolve o mesmo
 * (`criado: false`) para não quebrar links já enviados.
 */
export async function ativarCompartilhamento(
  db: Db,
  usuarioId: number,
  concursoId: number,
  agora: Date = new Date(),
): Promise<CompartilhamentoAtivo & { criado: boolean }> {
  return db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    const token = gerarTokenCompartilhamento();
    const [inserido] = await tx
      .insert(compartilhamentoConcurso)
      .values({ concursoId, token, createdAt: agora })
      .onConflictDoNothing({ target: compartilhamentoConcurso.concursoId })
      .returning({
        token: compartilhamentoConcurso.token,
        createdAt: compartilhamentoConcurso.createdAt,
      });
    if (inserido) return { ...inserido, criado: true };
    const [existente] = await tx
      .select({
        token: compartilhamentoConcurso.token,
        createdAt: compartilhamentoConcurso.createdAt,
      })
      .from(compartilhamentoConcurso)
      .where(eq(compartilhamentoConcurso.concursoId, concursoId))
      .limit(1);
    if (!existente) throw new Error("Falha ao carregar o compartilhamento do concurso.");
    return { ...existente, criado: false };
  });
}

/**
 * Gera um novo token de compartilhamento para o concurso, substituindo o anterior (`UPDATE`).
 * Devolve `tokenAnterior` (se havia) para invalidação imediata do cache ISR.
 */
export async function regenerarCompartilhamento(
  db: Db,
  usuarioId: number,
  concursoId: number,
  agora: Date = new Date(),
): Promise<CompartilhamentoAtivo & { tokenAnterior: string | null }> {
  return db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    const [anterior] = await tx
      .select({ token: compartilhamentoConcurso.token })
      .from(compartilhamentoConcurso)
      .where(eq(compartilhamentoConcurso.concursoId, concursoId))
      .limit(1);
    const token = gerarTokenCompartilhamento();
    if (anterior) {
      await tx
        .update(compartilhamentoConcurso)
        .set({ token, createdAt: agora })
        .where(eq(compartilhamentoConcurso.concursoId, concursoId));
      return { token, createdAt: agora, tokenAnterior: anterior.token };
    }
    await tx.insert(compartilhamentoConcurso).values({ concursoId, token, createdAt: agora });
    return { token, createdAt: agora, tokenAnterior: null };
  });
}

/**
 * Revoga o compartilhamento público do concurso (`DELETE`). Devolve `tokenAnterior` (se havia)
 * para invalidação imediata do cache ISR.
 */
export async function revogarCompartilhamento(
  db: Db,
  usuarioId: number,
  concursoId: number,
): Promise<{ tokenAnterior: string | null }> {
  return db.transaction(async (tx) => {
    await exigirConcurso(tx, usuarioId, concursoId);
    const [removido] = await tx
      .delete(compartilhamentoConcurso)
      .where(eq(compartilhamentoConcurso.concursoId, concursoId))
      .returning({ token: compartilhamentoConcurso.token });
    return { tokenAnterior: removido?.token ?? null };
  });
}
