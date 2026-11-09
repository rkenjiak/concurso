import type { Metadata } from "next";
import { connection } from "next/server";
import { AcoesUsuario } from "@/components/admin/acoes-usuario";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROTULO_PAPEL } from "@/domain/labels";
import { formatarDataHora, formatarDataInstante } from "@/lib/format";
import { exigirAdminPagina } from "@/server/auth/admin";
import { lerConfigAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { listarUsuarios, rotuloUsuario } from "@/server/repositories/admin";

export const metadata: Metadata = { title: "Usuários" };

/**
 * Selo de um token pessoal ativo (#108). O último uso vai no `title` (dica ao passar o mouse) e,
 * para leitores de tela, num texto oculto.
 */
function SeloToken({ rotulo, usadoEm }: { rotulo: string; usadoEm: Date | null }) {
  const uso = usadoEm ? `usado por último em ${formatarDataHora(usadoEm)}` : "ainda não usado";
  return (
    <Badge variant="outline" title={`${rotulo} ativo, ${uso}`}>
      {rotulo}
      <span className="sr-only">: token ativo, {uso}</span>
    </Badge>
  );
}

export default async function UsuariosAdminPage() {
  await connection();
  const admin = await exigirAdminPagina();
  const config = lerConfigAuth();
  const fixos: ReadonlySet<string> = config.habilitada ? config.emailsAdmin : new Set();
  const usuarios = await listarUsuarios(getDb());

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Usuários"
        descricao="Promova ou rebaixe admins e bloqueie o acesso. Sempre resta pelo menos um admin ativo."
      />
      <Card>
        <CardContent className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground text-xs">
              <tr className="border-b">
                <th className="py-2 pr-4 font-medium">Usuário</th>
                <th className="py-2 pr-4 font-medium">Papel</th>
                <th className="py-2 pr-4 font-medium">Cadastro</th>
                <th className="py-2 pr-4 font-medium">Último acesso</th>
                <th className="py-2 pr-4 font-medium">Tokens</th>
                <th className="py-2 pr-4 text-right font-medium">Concursos</th>
                <th className="py-2 text-right font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const ehVoce = u.id === admin.id;
                return (
                  <tr key={u.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium">
                        {u.nome ?? (u.email === null ? "Usuário inicial" : "Sem nome")}
                        {ehVoce ? (
                          <span className="ml-1 font-normal text-muted-foreground">(você)</span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground text-xs">{u.email ?? "sem e-mail"}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={u.papel === "ADMIN" ? "default" : "secondary"}>
                          {ROTULO_PAPEL[u.papel]}
                        </Badge>
                        {u.bloqueadoEm ? <Badge variant="destructive">Bloqueado</Badge> : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 tabular-nums">
                      {formatarDataInstante(u.createdAt)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 tabular-nums">
                      {formatarDataHora(u.ultimoAcessoEm)}
                    </td>
                    <td className="py-3 pr-4">
                      {u.mcpTokenAtivo || u.icsTokenAtivo ? (
                        <div className="flex flex-wrap gap-1">
                          {u.mcpTokenAtivo ? (
                            <SeloToken rotulo="MCP" usadoEm={u.mcpTokenUsadoEm} />
                          ) : null}
                          {u.icsTokenAtivo ? (
                            <SeloToken rotulo=".ics" usadoEm={u.icsTokenUsadoEm} />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{u.totalConcursos}</td>
                    <td className="py-3 text-right">
                      <AcoesUsuario
                        id={u.id}
                        rotulo={rotuloUsuario(u)}
                        ehAdmin={u.papel === "ADMIN"}
                        bloqueado={u.bloqueadoEm !== null}
                        ehVoce={ehVoce}
                        adminFixo={u.email !== null && fixos.has(u.email)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        Último acesso conta páginas, MCP por HTTP e feed .ics (registrado a cada 15 min, no máximo).
        O MCP local por stdio (<code>pnpm mcp</code>) não usa token e não é contado.
      </p>
    </div>
  );
}
