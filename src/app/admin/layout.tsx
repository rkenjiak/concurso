import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { BotaoVisaoUsuario } from "@/components/admin/botao-visao-usuario";
import { Casca } from "@/components/layout/casca";
import { Badge } from "@/components/ui/badge";
import { exigirAdminPagina } from "@/server/auth/admin";
import { lerConfigAuth } from "@/server/auth/config";

export const metadata: Metadata = {
  title: { template: "%s · Admin · Concursos", default: "Painel admin · Concursos" },
};

/**
 * Visão admin (#50): navegação do painel e faixa "Modo admin". Cada página também exige o papel
 * (`exigirAdminPagina`): o layout não é reexecutado em toda navegação.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection();
  const usuario = await exigirAdminPagina();
  return (
    <Casca
      visao="admin"
      conta={usuario}
      ehAdmin
      podeSair={lerConfigAuth().habilitada}
      selo={<Badge variant="destructive">Admin</Badge>}
      faixa={
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-amber-500/40 border-b bg-amber-500/15 px-4 py-2 text-amber-950 text-sm md:px-8 dark:text-amber-100"
        >
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          <span>
            <strong>Modo admin</strong> — você está gerenciando a instância.
          </span>
          <BotaoVisaoUsuario className="ml-auto" />
        </div>
      }
    >
      {children}
    </Casca>
  );
}
