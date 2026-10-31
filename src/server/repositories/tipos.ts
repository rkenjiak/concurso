import type { Db } from "../db/client";

/** Transação do Drizzle (mesma API de leitura/escrita do `Db`). */
export type Transacao = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Qualquer coisa que execute consultas: o banco ou uma transação aberta. */
export type Executor = Db | Transacao;
