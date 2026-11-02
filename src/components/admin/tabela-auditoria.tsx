import { ROTULO_ACAO_ADMIN } from "@/domain/labels";
import { formatarDataHora } from "@/lib/format";
import type { AuditoriaAdmin } from "@/server/db/schema";

/** Registros da auditoria administrativa (#50), do mais recente ao mais antigo. */
export function TabelaAuditoria({ registros }: { registros: AuditoriaAdmin[] }) {
  if (registros.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma ação administrativa registrada.</p>;
  }
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground text-xs">
          <tr className="border-b">
            <th className="py-2 pr-4 font-medium">Quando</th>
            <th className="py-2 pr-4 font-medium">Admin</th>
            <th className="py-2 pr-4 font-medium">Ação</th>
            <th className="py-2 font-medium">Alvo</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="whitespace-nowrap py-2 pr-4 tabular-nums">
                {formatarDataHora(r.createdAt)}
              </td>
              <td className="py-2 pr-4">{r.admin}</td>
              <td className="py-2 pr-4">{ROTULO_ACAO_ADMIN[r.acao]}</td>
              <td className="py-2">{r.alvo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
