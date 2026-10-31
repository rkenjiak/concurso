/**
 * `GET /api/export?formato=json|csv` (RF09, ARQUITETURA.md §5.3): baixa o backup JSON completo
 * (padrão) ou o CSV dos concursos.
 */
import { carimboSP } from "@/lib/tz";
import { respostaNaoAutorizada } from "@/server/auth/acesso";
import { getDb } from "@/server/db/client";
import { exportarConcursosCsv, exportarDados } from "@/server/queries/exportacao";

function anexo(corpo: string, tipo: string, nome: string): Response {
  return new Response(corpo, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const negado = await respostaNaoAutorizada();
  if (negado) return negado;
  const formato = new URL(request.url).searchParams.get("formato") ?? "json";
  const agora = new Date();
  const db = getDb();

  if (formato === "json") {
    const backup = await exportarDados(db, agora);
    return anexo(
      `${JSON.stringify(backup, null, 2)}\n`,
      "application/json; charset=utf-8",
      `concursos-backup-${carimboSP(agora)}.json`,
    );
  }
  if (formato === "csv") {
    return anexo(
      await exportarConcursosCsv(db),
      "text/csv; charset=utf-8",
      `concursos-${carimboSP(agora)}.csv`,
    );
  }
  return Response.json(
    { ok: false, erros: { _form: ['Formato inválido. Use "json" ou "csv".'] } },
    { status: 400 },
  );
}
