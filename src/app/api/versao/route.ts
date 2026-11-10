/**
 * `GET /api/versao` (#118, ARQUITETURA.md §5.3): versão, commit e ambiente da build no ar, para
 * conferir o deploy por `curl` ou monitoramento. Público (sem sessão, ver `proxy.ts`) e sem nada
 * além desses três campos (a data do build fica só no painel admin).
 */
import { ambiente, commit, versao } from "@/lib/versao";

export function GET(): Response {
  return Response.json({ versao, commit, ambiente }, { headers: { "Cache-Control": "no-store" } });
}
