/**
 * `GET /api/export?formato=json|csv|ics` (RF09/RF08, ARQUITETURA.md §5.3): baixa o backup JSON
 * completo (padrão), o CSV dos concursos ou o calendário `.ics` (#65) — apenas os dados do
 * usuário da sessão (#49).
 */
import type { NextRequest } from "next/server";
import { idSchema } from "@/lib/schemas/comum";
import { carimboSP } from "@/lib/tz";
import { exigirUsuarioRota } from "@/server/auth/acesso";
import { origemPublica } from "@/server/auth/login-google";
import { getDb } from "@/server/db/client";
import { gerarIcsDoUsuario } from "@/server/queries/calendario-ics";
import { exportarConcursosCsv, exportarDados } from "@/server/queries/exportacao";
import { obterUsuario } from "@/server/repositories/usuarios";

function anexo(corpo: string, tipo: string, nome: string): Response {
  return new Response(corpo, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

const naoEncontrado = () =>
  Response.json({ ok: false, erros: { _form: ["Concurso não encontrado."] } }, { status: 404 });

/**
 * Calendário `.ics` (#65): de um concurso (`&concurso=<id>`, com todos os eventos, inclusive
 * concluídos) ou de todos, com as mesmas opções do feed assinável.
 */
async function exportarIcs(request: NextRequest, usuarioId: number, agora: Date) {
  const db = getDb();
  const urlBase = origemPublica(request);
  const concursoBruto = request.nextUrl.searchParams.get("concurso");
  if (concursoBruto !== null) {
    const id = idSchema.safeParse(concursoBruto);
    if (!id.success) return naoEncontrado();
    const ics = await gerarIcsDoUsuario(
      db,
      usuarioId,
      { concursoId: id.data, incluirConcluidos: true, incluirEncerrados: true, urlBase },
      agora,
    );
    if (ics === null) return naoEncontrado();
    return anexo(ics, TIPO_ICS, `concurso-${id.data}-${carimboSP(agora)}.ics`);
  }
  const u = await obterUsuario(db, usuarioId);
  const ics = await gerarIcsDoUsuario(
    db,
    usuarioId,
    {
      incluirConcluidos: u?.icsIncluirConcluidos ?? true,
      incluirEncerrados: u?.icsIncluirEncerrados ?? false,
      urlBase,
    },
    agora,
  );
  return anexo(ics ?? "", TIPO_ICS, `concursos-${carimboSP(agora)}.ics`);
}

const TIPO_ICS = "text/calendar; charset=utf-8";

export async function GET(request: NextRequest): Promise<Response> {
  const usuario = await exigirUsuarioRota();
  if (usuario instanceof Response) return usuario;
  const params = request.nextUrl.searchParams;
  const formato = params.get("formato") ?? "json";
  const agora = new Date();
  const db = getDb();

  if (formato === "json") {
    const backup = await exportarDados(db, usuario.id, agora);
    return anexo(
      `${JSON.stringify(backup, null, 2)}\n`,
      "application/json; charset=utf-8",
      `concursos-backup-${carimboSP(agora)}.json`,
    );
  }
  if (formato === "csv") {
    return anexo(
      await exportarConcursosCsv(db, usuario.id),
      "text/csv; charset=utf-8",
      `concursos-${carimboSP(agora)}.csv`,
    );
  }
  if (formato === "ics") return exportarIcs(request, usuario.id, agora);
  return Response.json(
    { ok: false, erros: { _form: ['Formato inválido. Use "json", "csv" ou "ics".'] } },
    { status: 400 },
  );
}
