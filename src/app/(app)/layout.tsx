import { connection } from "next/server";
import type { ReactNode } from "react";
import { Casca } from "@/components/layout/casca";
import { hojeSP } from "@/lib/tz";
import { exigirUsuarioPagina } from "@/server/auth/acesso";
import { lerConfigAuth } from "@/server/auth/config";
import { getDb } from "@/server/db/client";
import { contarNotificacoesNaoLidas } from "@/server/queries/notificacoes";

/**
 * Layout do app (visão usuário): o mesmo para todos, admins inclusive — nada de admin aparece
 * aqui além do seletor de visão no menu da conta, visível só para admins (#50). O contador do sino
 * (#65) é recalculado na resposta de toda Server Action que revalida: com `revalidatePath`, o Next
 * re-renderiza a rota atual a partir da raiz (layout incluso) na mesma viagem, sem `router.refresh()`.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await connection();
  const usuario = await exigirUsuarioPagina();
  const naoLidas = await contarNotificacoesNaoLidas(getDb(), usuario.id, hojeSP());
  return (
    <Casca
      visao="usuario"
      conta={usuario}
      ehAdmin={usuario.papel === "ADMIN"}
      podeSair={lerConfigAuth().habilitada}
      naoLidas={naoLidas}
    >
      {children}
    </Casca>
  );
}
