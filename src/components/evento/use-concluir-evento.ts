"use client";

import { startTransition, useCallback, useOptimistic } from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { alternarConcluido, type ResultadoConcluir } from "@/server/actions/eventos";

/** Pedido de concluir/reabrir um evento (ver {@link useConcluirEvento}). */
export interface PedidoConcluir<K> {
  /** Chave do estado otimista (o id do evento na aba Eventos, a chave do item no painel). */
  id: K;
  concursoId: number;
  eventoId: number;
  /** Nome exibido nos avisos. */
  nome: string;
  concluido: boolean;
  /** Chave dos avisos de sucesso: um aviso novo do mesmo evento substitui o anterior. */
  chaveAviso: string;
  /** O aviso de erro também usa `chaveAviso` (senão, é um aviso avulso). */
  erroComChave: boolean;
  /** Reabertura pelo "Desfazer": sem o aviso "reaberto". */
  desfazendo?: boolean;
  /** Depois de gravar, dentro da mesma transição (estado da tela, pendência, foco). */
  aoGravar?: (dados: ResultadoConcluir) => void;
  /** Ação "Desfazer" do aviso "concluído". */
  desfazer: () => Promise<void>;
}

const SEM_OTIMISTAS: ReadonlyMap<unknown, boolean> = new Map();

/**
 * Concluir/reabrir evento otimista (#100, item 14 e D5; #107), comum à aba Eventos do concurso e
 * ao painel de evento. `otimistas` guarda, por `id`, a marcação enquanto a gravação não termina
 * (presença = em gravação). `alternar` grava e avisa: "“X” concluído." com "Desfazer", "“X”
 * reaberto." (exceto ao desfazer) ou, em falha, o erro — e a marcação volta. A promessa termina
 * com a gravação (`true` = gravou), para o "Desfazer" aguardá-la.
 */
export function useConcluirEvento<K>() {
  const { avisar } = useAvisos();
  const [otimistas, aplicarOtimista] = useOptimistic(
    SEM_OTIMISTAS as ReadonlyMap<K, boolean>,
    (atual: ReadonlyMap<K, boolean>, { id, concluido }: { id: K; concluido: boolean }) =>
      new Map(atual).set(id, concluido),
  );

  const alternar = useCallback(
    (p: PedidoConcluir<K>): Promise<boolean> =>
      new Promise<boolean>((resolver) => {
        startTransition(async () => {
          aplicarOtimista({ id: p.id, concluido: p.concluido });
          const r = await alternarConcluido(p.concursoId, p.eventoId, p.concluido);
          if (!r.ok) {
            avisar({
              texto:
                r.erros._form?.[0] ??
                `Não foi possível ${p.concluido ? "concluir" : "reabrir"} “${p.nome}”.`,
              tipo: "erro",
              ...(p.erroComChave ? { chave: p.chaveAviso } : {}),
            });
            resolver(false);
            return;
          }
          if (p.concluido) {
            avisar({
              texto: `“${p.nome}” concluído.`,
              chave: p.chaveAviso,
              acao: { rotulo: "Desfazer", executar: p.desfazer },
            });
          } else if (!p.desfazendo) {
            avisar({ texto: `“${p.nome}” reaberto.`, chave: p.chaveAviso });
          }
          p.aoGravar?.(r.data);
          resolver(true);
        });
      }),
    [aplicarOtimista, avisar],
  );

  return { otimistas, alternar };
}
