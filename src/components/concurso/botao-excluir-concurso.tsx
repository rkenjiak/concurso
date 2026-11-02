"use client";

import { Trash2 } from "lucide-react";
import { excluirConcurso } from "@/server/actions/concursos";
import { BotaoConfirmar } from "./botao-confirmar";

export function BotaoExcluirConcurso({ id, nome }: { id: number; nome: string }) {
  return (
    <BotaoConfirmar
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
    >
      <Trash2 aria-hidden />
      Excluir
    </BotaoConfirmar>
  );
}
