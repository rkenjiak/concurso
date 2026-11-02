"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { excluirConcurso } from "@/server/actions/concursos";
import { BotaoConfirmar } from "./botao-confirmar";

export function BotaoExcluirConcurso({ id, nome }: { id: number; nome: string }) {
  const router = useRouter();
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
      acao={() => excluirConcurso(id)}
      aoConcluir={() => {
        router.push("/concursos");
      }}
    >
      <Trash2 aria-hidden />
      Excluir
    </BotaoConfirmar>
  );
}
