/**
 * `GET /api/health` (ARQUITETURA.md §5.3): health check do deploy. Público (sem sessão); responde
 * 200 se o banco responde e 503 caso contrário, sem expor detalhes.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { log } from "@/server/log";

export async function GET(): Promise<Response> {
  try {
    await getDb().run(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    log.error("health.falhou", { erro });
    return Response.json(
      { status: "erro" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
