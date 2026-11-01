import { connection } from "next/server";
import type { ReactNode } from "react";
import { Casca } from "@/components/layout/casca";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { lerConfigAuth } from "@/server/auth/config";

/**
 * Layout do app (visão usuário): o mesmo para todos, admins inclusive — nada de admin aparece
 * aqui além do seletor de visão no menu da conta, visível só para admins (#50).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await connection();
  const usuario = await exigirUsuarioPagina();
  return (
    <Casca
      visao="usuario"
      conta={usuario}
      ehAdmin={usuario.papel === "ADMIN"}
      podeSair={lerConfigAuth().habilitada}
    >
      {children}
    </Casca>
  );
}
