/**
 * Backup do banco local (ARQUITETURA.md §9.3): `VACUUM INTO` gera uma cópia consistente do
 * SQLite (mesmo com o app rodando) em `backups/concurso-AAAAMMDD-HHmm.db`, mantendo as últimas N.
 */
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Client } from "@libsql/client";
import { carimboSP } from "../../lib/tz";

export const PASTA_BACKUPS = "backups";
export const MANTER_BACKUPS_PADRAO = 10;

const PREFIXO = "concurso-";
const RE_BACKUP = /^concurso-\d{8}-\d{4}(?:-\d+)?\.db$/;

/** `true` se a URL aponta para um arquivo SQLite local (onde `VACUUM INTO` faz sentido). */
export function ehBancoLocal(url: string): boolean {
  return url.startsWith("file:") && !url.includes(":memory:");
}

/** Caminho livre para o backup do instante (sufixo `-2`, `-3`… se já existir no mesmo minuto). */
export function caminhoBackup(pasta: string, agora: Date): string {
  const base = `${PREFIXO}${carimboSP(agora)}`;
  let caminho = join(pasta, `${base}.db`);
  for (let i = 2; existsSync(caminho); i++) caminho = join(pasta, `${base}-${i}.db`);
  return caminho;
}

/** Faz o backup com `VACUUM INTO` e retorna o caminho do arquivo gerado. */
export async function fazerBackup(
  client: Client,
  pasta: string = PASTA_BACKUPS,
  agora: Date = new Date(),
): Promise<string> {
  mkdirSync(pasta, { recursive: true });
  const destino = caminhoBackup(pasta, agora);
  await client.execute({ sql: "VACUUM INTO ?", args: [resolve(destino)] });
  return destino;
}

/** Remove os backups mais antigos, mantendo os `manter` mais recentes. Retorna os removidos. */
export function podarBackups(
  pasta: string = PASTA_BACKUPS,
  manter = MANTER_BACKUPS_PADRAO,
): string[] {
  if (!existsSync(pasta) || manter < 1) return [];
  // O nome ordena cronologicamente (carimbo AAAAMMDD-HHmm + sufixo numérico).
  const chave = (nome: string) => {
    const m = /^concurso-(\d{8}-\d{4})(?:-(\d+))?\.db$/.exec(nome);
    return `${m?.[1]}-${(m?.[2] ?? "1").padStart(6, "0")}`;
  };
  const backups = readdirSync(pasta)
    .filter((nome) => RE_BACKUP.test(nome))
    .sort((a, b) => chave(a).localeCompare(chave(b)));
  const remover = backups.slice(0, Math.max(0, backups.length - manter));
  for (const nome of remover) rmSync(join(pasta, nome));
  return remover;
}
