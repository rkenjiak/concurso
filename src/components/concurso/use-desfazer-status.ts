"use client";

import { useRouter } from "next/navigation";
import type { TransitionStartFunction } from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { ROTULO_STATUS } from "@/domain/labels";
import { desfazerUltimoStatus } from "@/server/actions/status";

/**
 * "Desfazer" do aviso de mudança de status (#100, D4 e D7; #107), comum ao "Mudar status" do
 * concurso e ao quadro. Devolve `desfazer(concursoId, registroId)`: desfaz a mudança
 * `registroId` — só se ainda for a última (o servidor confere) — e anuncia o resultado na chave
 * do concurso; em falha, busca o estado atual. A promessa termina com a ação (o aviso mostra a
 * pendência). Roda em `iniciar`, a transição do componente (seus controles ficam ocupados).
 */
export function useDesfazerStatus(iniciar: TransitionStartFunction) {
  const router = useRouter();
  const { avisar } = useAvisos();

  return function desfazer(concursoId: number, registroId: number): Promise<void> {
    const chave = `status-${concursoId}`;
    return new Promise<void>((resolver) => {
      iniciar(async () => {
        const r = await desfazerUltimoStatus(concursoId, { registroId });
        avisar(
          r.ok
            ? {
                texto: `Mudança desfeita: de volta a “${ROTULO_STATUS[r.data.status]}”.`,
                tipo: "info",
                chave,
              }
            : { texto: r.erros._form?.[0] ?? "Não foi possível desfazer.", tipo: "erro", chave },
        );
        // Falhou: nada foi revalidado; busca o estado atual (outra aba pode ter mudado o status).
        if (!r.ok) router.refresh();
        resolver();
      });
    });
  };
}
