"use client";

import { KeyRound } from "lucide-react";
import { useAvisos } from "@/components/avisos/avisos";
import { BotaoConfirmar } from "@/components/concurso/botao-confirmar";
import { revogarTokensAcao } from "@/server/actions/admin";

/**
 * Revoga os tokens pessoais (MCP e feed .ics) de um usuário sem bloqueá-lo (#108). Só aparece com
 * algum token ativo; a ação é auditada no servidor. Se outra aba já tiver revogado, o servidor não
 * muda nada (nem audita) e o aviso diz isso.
 */
export function BotaoRevogarTokens({ id, rotulo }: { id: number; rotulo: string }) {
  const { avisar } = useAvisos();
  return (
    <BotaoConfirmar
      tamanho="sm"
      destrutivo
      titulo="Revogar tokens?"
      descricao={`O token do MCP e o link do feed .ics de ${rotulo} deixam de valer na hora. A conta continua ativa: ${rotulo} pode gerar outros em Configurações.`}
      rotuloConfirmar="Revogar"
      rotuloAcessivel={`Revogar tokens de ${rotulo}`}
      acao={async () => {
        const r = await revogarTokensAcao(id);
        if (r.ok) {
          avisar(
            r.data.revogou
              ? { texto: `Tokens de ${rotulo} revogados.` }
              : { texto: "Já não havia tokens ativos.", tipo: "info" },
          );
        }
        return r;
      }}
    >
      <KeyRound aria-hidden />
      Revogar tokens
    </BotaoConfirmar>
  );
}
