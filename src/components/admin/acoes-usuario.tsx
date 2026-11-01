"use client";

import { Ban, ShieldMinus, ShieldPlus, Undo2 } from "lucide-react";
import { BotaoConfirmar } from "@/components/concurso/botao-confirmar";
import { definirBloqueioAcao, definirPapelAcao } from "@/server/actions/admin";

interface AcoesUsuarioProps {
  id: number;
  rotulo: string;
  ehAdmin: boolean;
  bloqueado: boolean;
  /** É o próprio admin logado. */
  ehVoce: boolean;
  /** Admin garantido por `ADMIN_EMAILS` (não pode ser rebaixado nem bloqueado aqui). */
  adminFixo: boolean;
}

/**
 * Promover/rebaixar e bloquear/desbloquear um usuário (#50). As regras (último admin ativo,
 * `ADMIN_EMAILS`) são conferidas no servidor; aqui só se escondem ações impossíveis.
 */
export function AcoesUsuario({
  id,
  rotulo,
  ehAdmin,
  bloqueado,
  ehVoce,
  adminFixo,
}: AcoesUsuarioProps) {
  if (adminFixo) {
    return <span className="text-muted-foreground text-xs">Definido em ADMIN_EMAILS</span>;
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {ehAdmin ? (
        <BotaoConfirmar
          tamanho="sm"
          titulo="Rebaixar a usuário?"
          descricao={
            ehVoce
              ? "Você deixará de ser admin e voltará para a visão usuário."
              : `${rotulo} deixará de ser admin.`
          }
          rotuloConfirmar="Rebaixar"
          rotuloAcessivel={`Rebaixar ${rotulo}`}
          acao={() => definirPapelAcao(id, "USUARIO")}
        >
          <ShieldMinus aria-hidden />
          Rebaixar
        </BotaoConfirmar>
      ) : bloqueado ? null : (
        <BotaoConfirmar
          tamanho="sm"
          titulo="Promover a admin?"
          descricao={`${rotulo} poderá gerenciar usuários e o acesso à instância.`}
          rotuloConfirmar="Promover"
          rotuloAcessivel={`Promover ${rotulo} a admin`}
          acao={() => definirPapelAcao(id, "ADMIN")}
        >
          <ShieldPlus aria-hidden />
          Promover a admin
        </BotaoConfirmar>
      )}
      {ehVoce ? null : bloqueado ? (
        <BotaoConfirmar
          tamanho="sm"
          titulo="Desbloquear usuário?"
          descricao={`${rotulo} volta a ter acesso (se o e-mail continuar autorizado).`}
          rotuloConfirmar="Desbloquear"
          rotuloAcessivel={`Desbloquear ${rotulo}`}
          acao={() => definirBloqueioAcao(id, false)}
        >
          <Undo2 aria-hidden />
          Desbloquear
        </BotaoConfirmar>
      ) : (
        <BotaoConfirmar
          tamanho="sm"
          destrutivo
          titulo="Bloquear usuário?"
          descricao={`${rotulo} perde o acesso na hora, inclusive sessões abertas e o token do MCP. Os dados são mantidos.`}
          rotuloConfirmar="Bloquear"
          rotuloAcessivel={`Bloquear ${rotulo}`}
          acao={() => definirBloqueioAcao(id, true)}
        >
          <Ban aria-hidden />
          Bloquear
        </BotaoConfirmar>
      )}
    </div>
  );
}
