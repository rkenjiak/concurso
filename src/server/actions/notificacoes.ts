"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TIPO_EVENTO } from "@/domain/enums";
import {
  lerAntecedencias,
  lerChaveNotificacao,
  type RegraNotificacao,
} from "@/domain/notificacoes";
import { idSchema } from "@/lib/schemas/comum";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import { obterNotificacoes } from "../queries/notificacoes";
import {
  type AcaoNotificacao,
  definirConcursoSilenciado,
  marcarNotificacoes,
  restaurarRegrasPadrao,
  salvarRegras,
} from "../repositories/notificacoes";
import { executar, falha, type ResultadoAcao, sucesso } from "./resultado";

/** O sino fica no layout: qualquer mudança nas notificações revalida todas as páginas. */
const revalidarTudo = () => revalidatePath("/", "layout");

async function marcar(chaveBruta: unknown, acao: AcaoNotificacao): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const alvo = lerChaveNotificacao(chaveBruta);
  if (!alvo) return falha("Notificação não encontrada.");
  return executar(async () => {
    await marcarNotificacoes(getDb(), sessao.usuario.id, [alvo], acao);
    revalidarTudo();
    return sucesso(null);
  });
}

/** Marca uma notificação (`evento-<id>:<dias>` / `validade-<concursoId>:<dias>`) como lida. */
export async function marcarNotificacaoLidaAcao(chave: unknown): Promise<ResultadoAcao> {
  return marcar(chave, "LER");
}

/** Dispensa a notificação: some da lista (até a próxima antecedência do mesmo prazo). */
export async function dispensarNotificacaoAcao(chave: unknown): Promise<ResultadoAcao> {
  return marcar(chave, "DISPENSAR");
}

/** Marca como lidas todas as notificações disparadas hoje. */
export async function marcarTodasLidasAcao(): Promise<ResultadoAcao<{ marcadas: number }>> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  return executar(async () => {
    const db = getDb();
    const alvos = (await obterNotificacoes(db, usuarioId, hojeSP()))
      .filter((n) => !n.lida)
      .flatMap((n) => {
        const alvo = lerChaveNotificacao(n.chave);
        return alvo ? [alvo] : [];
      });
    await marcarNotificacoes(db, usuarioId, alvos, "LER");
    revalidarTudo();
    return sucesso({ marcadas: alvos.length });
  });
}

const regrasSchema = z
  .array(
    z.object({
      tipo: z.enum(TIPO_EVENTO, { error: "Tipo de evento inválido." }),
      ativo: z.boolean({ error: "Valor inválido." }),
      antecedencias: z.string().max(200),
    }),
  )
  .max(TIPO_EVENTO.length);

/**
 * Salva as regras de notificação. `antecedencias` vem como digitado ("7, 1, 0"); erros voltam por
 * tipo de evento (chave = tipo).
 */
export async function salvarRegrasNotificacaoAcao(entrada: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const dados = regrasSchema.safeParse(entrada);
  if (!dados.success) return falha("Regras inválidas.");
  const erros: Record<string, string[]> = {};
  const regras: RegraNotificacao[] = [];
  for (const r of dados.data) {
    const lidas = lerAntecedencias(r.antecedencias);
    if (!lidas.ok) {
      erros[r.tipo] = [lidas.erro];
      continue;
    }
    regras.push({ tipo: r.tipo, ativo: r.ativo, antecedencias: lidas.dias });
  }
  if (Object.keys(erros).length > 0) {
    return { ok: false, erros: { ...erros, _form: ["Corrija as antecedências destacadas."] } };
  }
  return executar(async () => {
    await salvarRegras(getDb(), sessao.usuario.id, regras);
    revalidarTudo();
    return sucesso(null);
  });
}

/** Volta todas as regras ao padrão. */
export async function restaurarRegrasPadraoAcao(): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  return executar(async () => {
    await restaurarRegrasPadrao(getDb(), sessao.usuario.id);
    revalidarTudo();
    return sucesso(null);
  });
}

const booleano = z.boolean({ error: "Valor inválido." });

/** Silencia (ou reativa) as notificações e os alarmes do calendário de um concurso. */
export async function silenciarConcursoAcao(
  idBruto: unknown,
  silenciadoBruto: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha("Concurso não encontrado.");
  const silenciado = booleano.safeParse(silenciadoBruto);
  if (!silenciado.success) return falha("Valor inválido.");
  return executar(async () => {
    await definirConcursoSilenciado(getDb(), sessao.usuario.id, id.data, silenciado.data);
    revalidarTudo();
    return sucesso(null);
  });
}
