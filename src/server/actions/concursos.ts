"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { urlComAba } from "@/lib/aba-concurso";
import { urlComAviso } from "@/lib/aviso-url";
import { idSchema } from "@/lib/schemas/comum";
import { concursoEdicaoSchema, concursoSchema } from "@/lib/schemas/concurso";
import { exigirUsuarioAcao } from "../auth/acesso";
import { getDb } from "../db/client";
import * as repo from "../repositories/concursos";
import { executar, falha, falhaValidacao, type ResultadoAcao, sucesso } from "./resultado";

const NAO_ENCONTRADO = "Concurso não encontrado.";

/**
 * Criar, editar e excluir terminam em outra página: o `redirect` na action faz a resposta já trazer
 * a página de destino (uma viagem só, #73), em vez de re-renderizar a atual e o cliente navegar
 * depois. Fica fora de `executar`, cujo `catch` engoliria o erro de controle do `redirect`. Em
 * caso de sucesso a action não retorna; só as falhas chegam ao cliente. O concurso recém-criado abre
 * na aba Eventos, onde o estado vazio orienta a cadastrar as datas (#100, D9). O destino leva
 * `?aviso=` para a página confirmar a ação com um aviso, e o remove da URL (#100, item 12).
 */

export async function criarConcurso(entrada: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const dados = concursoSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  const r = await executar(
    async () => {
      const id = await repo.criarConcurso(getDb(), usuarioId, dados.data);
      revalidatePath("/concursos");
      revalidatePath("/");
      return sucesso({ id });
    },
    { acao: "concursos.criarConcurso", usuarioId },
  );
  if (r.ok)
    redirect(urlComAviso(urlComAba(`/concursos/${r.data.id}`, "eventos"), "concurso-criado"));
  return r;
}

export async function atualizarConcurso(
  idBruto: unknown,
  entrada: unknown,
): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha(NAO_ENCONTRADO);
  const dados = concursoEdicaoSchema.safeParse(entrada);
  if (!dados.success) return falhaValidacao(dados.error);
  const r = await executar(
    async () => {
      if (!(await repo.atualizarConcurso(getDb(), usuarioId, id.data, dados.data)))
        return falha(NAO_ENCONTRADO);
      revalidatePath("/concursos");
      revalidatePath(`/concursos/${id.data}`);
      revalidatePath("/");
      return sucesso(null);
    },
    { acao: "concursos.atualizarConcurso", usuarioId },
  );
  if (r.ok) redirect(urlComAviso(`/concursos/${id.data}`, "concurso-salvo"));
  return r;
}

export async function excluirConcurso(idBruto: unknown): Promise<ResultadoAcao> {
  const sessao = await exigirUsuarioAcao();
  if (!sessao.ok) return sessao;
  const usuarioId = sessao.usuario.id;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return falha(NAO_ENCONTRADO);
  const r = await executar(
    async () => {
      if (!(await repo.excluirConcurso(getDb(), usuarioId, id.data))) return falha(NAO_ENCONTRADO);
      revalidatePath("/concursos");
      revalidatePath("/");
      return sucesso(null);
    },
    { acao: "concursos.excluirConcurso", usuarioId },
  );
  if (r.ok) redirect(urlComAviso("/concursos", "concurso-excluido"));
  return r;
}
