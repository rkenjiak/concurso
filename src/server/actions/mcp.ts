"use server";

import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import { gerarTokenMcp, revogarTokenMcp } from "../repositories/usuarios";
import { executar, type ResultadoAcao, sucesso } from "./resultado";

/**
 * Gera o token pessoal do MCP por HTTP (#49), invalidando o anterior. O token só é devolvido
 * agora: o banco guarda apenas o resumo.
 */
export async function gerarTokenMcpAcao(): Promise<ResultadoAcao<{ token: string }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  return executar(async () => sucesso({ token: await gerarTokenMcp(getDb(), sessao.usuario.id) }));
}

/** Revoga o token pessoal do MCP. */
export async function revogarTokenMcpAcao(): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  return executar(async () => {
    await revogarTokenMcp(getDb(), sessao.usuario.id);
    return sucesso(null);
  });
}
