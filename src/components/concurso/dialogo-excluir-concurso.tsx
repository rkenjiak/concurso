"use client";

import { excluirConcurso } from "@/server/actions/concursos";
import { DialogoConfirmar } from "./botao-confirmar";

/**
 * Confirmação da exclusão do concurso, controlada pelo chamador (aberta pelo item "Excluir" do
 * menu "Mais ações", #100, D8).
 */
export function DialogoExcluirConcurso({
  id,
  nome,
  aberto,
  aoMudarAberto,
  focoAoFechar,
}: {
  id: number;
  nome: string;
  aberto: boolean;
  aoMudarAberto: (aberto: boolean) => void;
  focoAoFechar?: () => HTMLElement | null;
}) {
  return (
    <DialogoConfirmar
      aberto={aberto}
      aoMudarAberto={aoMudarAberto}
      focoAoFechar={focoAoFechar}
      titulo="Excluir concurso?"
      descricao={
        <>
          <strong>{nome}</strong> será excluído junto com links, eventos, histórico e resultados.
          Esta ação não pode ser desfeita.
        </>
      }
      rotuloConfirmar="Excluir"
      destrutivo
      // Em caso de sucesso a action redireciona para /concursos na própria resposta (#73).
      acao={() => excluirConcurso(id)}
    />
  );
}
