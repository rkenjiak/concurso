/**
 * Backup do banco local (`pnpm db:backup`, ARQUITETURA.md §9.3): cópia consistente com
 * `VACUUM INTO` em `backups/concurso-AAAAMMDD-HHmm.db`, mantendo as últimas N cópias.
 *
 * Uso: `pnpm db:backup [--manter=N]` (padrão: BACKUP_KEEP ou 10).
 * Para restaurar: pare o app e copie o arquivo do backup para o caminho de DATABASE_URL.
 */

import {
  ehBancoLocal,
  fazerBackup,
  MANTER_BACKUPS_PADRAO,
  PASTA_BACKUPS,
  podarBackups,
} from "../src/server/db/backup";
import { criarDb, urlDoBanco } from "../src/server/db/client";
import { carregarEnv } from "./env";

carregarEnv();

const url = urlDoBanco();
const argManter = process.argv.find((a) => a.startsWith("--manter="))?.split("=")[1];
const manter = Number(argManter ?? process.env.BACKUP_KEEP ?? MANTER_BACKUPS_PADRAO);

if (!ehBancoLocal(url)) {
  console.error(
    "db:backup funciona apenas com banco local (DATABASE_URL=file:…). No Turso, use o " +
      "point-in-time restore do serviço e o export JSON em Configurações.",
  );
  process.exitCode = 1;
} else if (!Number.isInteger(manter) || manter < 1) {
  console.error("--manter/BACKUP_KEEP deve ser um inteiro maior ou igual a 1.");
  process.exitCode = 1;
} else {
  const { client } = criarDb({ url });
  try {
    const arquivo = await fazerBackup(client);
    console.log(`Backup criado: ${arquivo}`);
    const removidos = podarBackups(PASTA_BACKUPS, manter);
    if (removidos.length > 0) {
      console.log(`Backups antigos removidos (mantendo ${manter}): ${removidos.join(", ")}`);
    }
  } catch (erro) {
    console.error("Falha no backup:", erro);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}
