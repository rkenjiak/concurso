import type { Metadata } from "next";
import { connection } from "next/server";
import { TabelaAuditoria } from "@/components/admin/tabela-auditoria";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Card, CardContent } from "@/components/ui/card";
import { exigirAdminPagina } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { listarAuditoria } from "@/server/repositories/admin";

export const metadata: Metadata = { title: "Auditoria" };

const LIMITE = 200;

export default async function AuditoriaPage() {
  await connection();
  await exigirAdminPagina();
  const registros = await listarAuditoria(getDb(), LIMITE);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Auditoria"
        descricao={`Ações administrativas: papéis, bloqueios e lista de acesso (últimas ${LIMITE}).`}
      />
      <Card>
        <CardContent>
          <TabelaAuditoria registros={registros} />
        </CardContent>
      </Card>
    </div>
  );
}
