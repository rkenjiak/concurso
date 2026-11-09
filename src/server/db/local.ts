/**
 * Proteções do SQLite local (`file:`) contra `SQLITE_BUSY` (#112).
 *
 * O `@libsql/client` abre um pool de conexões ao mesmo arquivo, e cada transação fica com uma
 * conexão só dela. Sem cuidado, requisições concorrentes do mesmo processo disputam o lock do
 * arquivo, e o pior não é o erro em si: uma instrução que falha com `SQLITE_BUSY` fica ativa, sem
 * reset (o driver não expõe reset nem finalize; só o GC a libera), e a conexão dela passa a segurar
 * uma transação de leitura que não termina. No journal de rollback isso faz falhar todo COMMIT e
 * toda escrita seguinte; em WAL, faz a conexão ler um snapshot velho e trava o checkpoint.
 *
 * Por isso o objetivo é que escritas não levem `SQLITE_BUSY`, e não só sobreviver a ele:
 * - **uma escrita por vez no processo**: transações (exceto `"read"`), `batch`, `migrate`,
 *   `executeMultiple` e todo `execute` que não seja `SELECT` passam por uma fila. A transação
 *   segura a vez até `commit`, `rollback` ou `close`. Leituras não entram na fila;
 * - **WAL**: leituras não bloqueiam escritas nem são bloqueadas por elas (ligado na primeira
 *   operação; o modo fica gravado no arquivo);
 * - **busy timeout** (`ESPERA_LOCK_MS`): só vale contra *outros processos* (MCP stdio, scripts,
 *   e2e). Dentro do processo a fila já impede a disputa, e a espera do driver é síncrona: sem a
 *   fila, ela só travaria o event loop enquanto a outra transação, que precisa dele para
 *   terminar, ficava parada.
 *
 * Cuidado: dentro do callback de `db.transaction`, use o `tx`. Uma escrita pelo `db` de fora
 * esperaria a vez que a própria transação segura e falharia com `SQLITE_BUSY` após a espera.
 */
import {
  type Client,
  type InArgs,
  type InStatement,
  LibsqlError,
  type ResultSet,
  type Transaction,
  type TransactionMode,
} from "@libsql/client";
import { log } from "../log";

/** Espera máxima pela vez de escrever (fila do processo) e pelo lock de outro processo. */
export const ESPERA_LOCK_MS = 5_000;

/** `true` se a URL é um arquivo SQLite local (não `:memory:` nem remoto). */
export function ehArquivoLocal(url: string): boolean {
  return url.startsWith("file:") && !url.includes(":memory:");
}

function erroOcupado(esperaMs: number): LibsqlError {
  return new LibsqlError(
    `SQLITE_BUSY: a vez de escrever no banco não chegou em ${esperaMs} ms`,
    "SQLITE_BUSY",
  );
}

/**
 * Fila FIFO de uma posição: `entrar` resolve com a função que libera a vez. Quem desiste por tempo
 * esgotado sai da fila sem segurar ninguém (passa a vez adiante assim que ela chega).
 */
export class FilaEscrita {
  #cauda: Promise<void> = Promise.resolve();

  constructor(private readonly esperaMs: number = ESPERA_LOCK_MS) {}

  entrar(): Promise<() => void> {
    const anterior = this.#cauda;
    let passarAVez!: () => void;
    this.#cauda = new Promise<void>((resolver) => {
      passarAVez = resolver;
    });
    return new Promise((resolver, rejeitar) => {
      let desistiu = false;
      const timer = setTimeout(() => {
        desistiu = true;
        rejeitar(erroOcupado(this.esperaMs));
      }, this.esperaMs);
      void anterior.then(() => {
        clearTimeout(timer);
        if (desistiu) {
          passarAVez();
          return;
        }
        let liberada = false;
        resolver(() => {
          if (liberada) return;
          liberada = true;
          passarAVez();
        });
      });
    });
  }

  /** Executa `fn` na sua vez e a libera ao terminar (com sucesso ou erro). */
  async na<T>(fn: () => Promise<T>): Promise<T> {
    const liberar = await this.entrar();
    try {
      return await fn();
    } finally {
      liberar();
    }
  }
}

/** Só `SELECT` dispensa a fila; `WITH`, `PRAGMA` etc. podem escrever e entram nela. */
const ehLeitura = (sql: string) => /^\s*select\b/i.test(sql);

const sqlDe = (stmt: InStatement | string) => (typeof stmt === "string" ? stmt : stmt.sql);

/** Transação que devolve a vez de escrever quando termina, do jeito que for. */
function transacaoQueLibera(tx: Transaction, liberar: () => void): Transaction {
  const terminar = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } finally {
      liberar();
    }
  };
  return {
    execute: (stmt) => tx.execute(stmt),
    batch: (stmts) => tx.batch(stmts),
    executeMultiple: (sql) => tx.executeMultiple(sql),
    commit: () => terminar(() => tx.commit()),
    rollback: () => terminar(() => tx.rollback()),
    close: () => {
      try {
        tx.close();
      } finally {
        liberar();
      }
    },
    get closed() {
      return tx.closed;
    },
  };
}

/** Liga o WAL (persistente no arquivo). Falha (ex.: arquivo somente leitura) só gera aviso. */
async function ligarWal(client: Client): Promise<void> {
  try {
    await client.execute("PRAGMA journal_mode = WAL");
  } catch (erro) {
    log.warn("db.wal_falhou", { erro });
  }
}

/**
 * Envolve o client de um banco local com as proteções acima. `preparar` roda uma vez, na vez de
 * escrever, antes da primeira operação (padrão: liga o WAL).
 */
export function protegerClienteLocal(
  base: Client,
  opcoes: { esperaMs?: number; preparar?: (client: Client) => Promise<void> } = {},
): Client {
  const fila = new FilaEscrita(opcoes.esperaMs);
  const preparar = opcoes.preparar ?? ligarWal;
  let pronto: Promise<void> | undefined;
  const garantirPronto = () => {
    pronto ??= fila.na(() => preparar(base));
    return pronto;
  };

  const ler = async <T>(fn: () => Promise<T>) => {
    await garantirPronto();
    return fn();
  };
  const escrever = async <T>(fn: () => Promise<T>) => {
    await garantirPronto();
    return fila.na(fn);
  };

  const cliente: Client = {
    execute(stmt: InStatement | string, args?: InArgs): Promise<ResultSet> {
      const executar = () =>
        typeof stmt === "string" ? base.execute(stmt, args) : base.execute(stmt);
      return ehLeitura(sqlDe(stmt)) ? ler(executar) : escrever(executar);
    },
    batch(stmts, mode?: TransactionMode) {
      return mode === "read"
        ? ler(() => base.batch(stmts, mode))
        : escrever(() => base.batch(stmts, mode));
    },
    migrate: (stmts) => escrever(() => base.migrate(stmts)),
    executeMultiple: (sql) => escrever(() => base.executeMultiple(sql)),
    async transaction(mode?: TransactionMode): Promise<Transaction> {
      await garantirPronto();
      if (mode === "read") return base.transaction(mode);
      const liberar = await fila.entrar();
      try {
        return transacaoQueLibera(await base.transaction(mode), liberar);
      } catch (erro) {
        liberar();
        throw erro;
      }
    },
    sync: () => base.sync(),
    close: () => base.close(),
    reconnect: () => base.reconnect(),
    get closed() {
      return base.closed;
    },
    get protocol() {
      return base.protocol;
    },
  };
  return cliente;
}
