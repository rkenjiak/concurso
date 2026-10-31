import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client";

/** Pasta das migrações SQL geradas pelo drizzle-kit (versionadas no repositório). */
export const PASTA_MIGRACOES = join(process.cwd(), "drizzle");

/** Aplica as migrações pendentes (idempotente). */
export async function aplicarMigracoes(db: Db, pasta: string = PASTA_MIGRACOES): Promise<void> {
  await migrate(db, { migrationsFolder: pasta });
}
