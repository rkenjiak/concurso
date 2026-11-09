"use client";

import { KeyRound } from "lucide-react";
import { BotaoConfirmar } from "@/components/concurso/botao-confirmar";
import { revogarTokensAcao } from "@/server/actions/admin";

/**
 * Revoga os tokens pessoais (MCP e feed .ics) de um usuário sem bloqueá-lo (#108). Só aparece com
 * algum token ativo; a ação é auditada no servidor.
 */
export function BotaoRevogarTokens({ id, rotulo }: { id: number; rotulo: string }) {
  return (
    <BotaoConfirmar
      tamanho="sm"
      destrutivo
      titulo="Revogar tokens?"
      descricao={`O token do MCP e o link do feed .ics de ${rotulo} deixam de valer na hora. A conta continua ativa: ${rotulo} pode gerar outros em Configurações.`}
      rotuloConfirmar="Revogar"
      rotuloAcessivel={`Revogar tokens de ${rotulo}`}
      acao={() => revogarTokensAcao(id)}
    >
      <KeyRound aria-hidden />
      Revogar tokens
    </BotaoConfirmar>
  );
}
