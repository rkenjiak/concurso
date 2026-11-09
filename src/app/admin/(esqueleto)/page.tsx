import {
  Activity,
  Ban,
  CalendarDays,
  CalendarSync,
  ClipboardList,
  KeyRound,
  type LucideIcon,
  PlugZap,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { TabelaAuditoria } from "@/components/admin/tabela-auditoria";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirAdminPagina } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { listarAuditoria, obterResumo } from "@/server/repositories/admin";

export const metadata: Metadata = { title: "Visão geral" };

/** Cartão de um total da visão geral. */
function CartaoTotal({
  rotulo,
  valor,
  icone: Icone,
}: {
  rotulo: string;
  valor: number;
  icone: LucideIcon;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <Icone className="size-5 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-muted-foreground text-xs">{rotulo}</p>
          <p className="font-semibold text-2xl tabular-nums">{valor}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminPage() {
  await connection();
  await exigirAdminPagina();
  const db = getDb();
  const [resumo, recentes] = await Promise.all([obterResumo(db), listarAuditoria(db, 5)]);
  const totais = [
    { rotulo: "Usuários", valor: resumo.usuarios, icone: Users },
    { rotulo: "Admins ativos", valor: resumo.admins, icone: ShieldCheck },
    { rotulo: "Bloqueados", valor: resumo.bloqueados, icone: Ban },
    { rotulo: "E-mails liberados no painel", valor: resumo.emailsPermitidos, icone: KeyRound },
    { rotulo: "Concursos", valor: resumo.concursos, icone: ClipboardList },
    { rotulo: "Eventos", valor: resumo.eventos, icone: CalendarDays },
  ];
  const uso = [
    { rotulo: "Ativos em 7 dias", valor: resumo.ativos7Dias, icone: Activity },
    { rotulo: "Ativos em 30 dias", valor: resumo.ativos30Dias, icone: Activity },
    { rotulo: "Com token do MCP", valor: resumo.comTokenMcp, icone: PlugZap },
    { rotulo: "Com feed .ics", valor: resumo.comFeedIcs, icone: CalendarSync },
  ];

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Visão geral"
        descricao="Totais da instância. Os dados dos usuários continuam privados."
      />
      <section aria-label="Totais" className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {totais.map((t) => (
          <CartaoTotal key={t.rotulo} {...t} />
        ))}
      </section>
      <section aria-labelledby="titulo-uso" className="space-y-3">
        <h2 id="titulo-uso" className="font-medium text-sm">
          Uso
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {uso.map((t) => (
            <CartaoTotal key={t.rotulo} {...t} />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Ativos: último acesso por página, MCP por HTTP ou feed .ics. O MCP local por stdio (
          <code>pnpm mcp</code>) não usa token e não é contado.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Ações recentes</CardTitle>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/auditoria">Ver auditoria</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TabelaAuditoria registros={recentes} />
        </CardContent>
      </Card>
    </div>
  );
}
