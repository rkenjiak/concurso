/**
 * `POST /api/import` (RF09, ARQUITETURA.md §5.3): restaura um backup JSON substituindo todos os
 * dados. Corpo `multipart/form-data` com `arquivo` (o JSON) e `confirmacao=SUBSTITUIR_TUDO`.
 *
 * Route Handler (e não Server Action) para aceitar arquivos maiores que o limite de corpo das
 * Server Actions. Responde no formato padronizado `{ ok, data } | { ok, erros }`.
 */
import { revalidatePath } from "next/cache";
import { ErroDominio } from "@/domain/erros";
import { CONFIRMACAO_IMPORTACAO, TAMANHO_MAX_BACKUP, validarBackup } from "@/lib/schemas/backup";
import { falha, sucesso } from "@/server/actions/resultado";
import { respostaNaoAutorizada } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { substituirTudo } from "@/server/repositories/importacao";

const erro = (mensagem: string, status = 400) => Response.json(falha(mensagem), { status });

export async function POST(request: Request): Promise<Response> {
  const negado = await respostaNaoAutorizada();
  if (negado) return negado;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return erro("Envie o arquivo de backup.");
  }
  if (form.get("confirmacao") !== CONFIRMACAO_IMPORTACAO) {
    return erro("Confirme que deseja substituir todos os dados atuais.");
  }
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return erro("Selecione o arquivo de backup (.json).");
  }
  if (arquivo.size > TAMANHO_MAX_BACKUP) {
    return erro("Arquivo grande demais para um backup deste app.", 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(await arquivo.text());
  } catch {
    return erro("O arquivo não é um JSON válido.");
  }

  try {
    const resumo = await substituirTudo(getDb(), validarBackup(json));
    revalidatePath("/", "layout");
    return Response.json(sucesso(resumo));
  } catch (e) {
    if (e instanceof ErroDominio) return erro(e.message);
    console.error(e);
    return erro("Não foi possível importar o backup. Nenhum dado foi alterado.", 500);
  }
}
