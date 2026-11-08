"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useId, useTransition } from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { alternarPrazoOculto } from "@/server/actions/dashboard";

interface BotaoOcultarPrazoProps {
  /** Chave do prazo (`evento-<id>` ou `validade-<concursoId>`). */
  chave: string;
  /** Estado atual: `true` mostra a ação de reexibir. */
  oculto: boolean;
  /** Nome do prazo, para os avisos. */
  nome: string;
  /** Chamado com o novo estado depois de gravado. */
  aoAlterar?: (oculto: boolean) => void;
  className?: string;
}

/**
 * Oculta ou reexibe um prazo no dashboard (#44), no rodapé do painel do evento (#100, D6). A
 * preferência é gravada no banco; a dica deixa claro que ocultar não conclui o prazo. Retorno por
 * aviso, com "Desfazer" ao ocultar.
 */
export function BotaoOcultarPrazo({
  chave,
  oculto,
  nome,
  aoAlterar,
  className,
}: BotaoOcultarPrazoProps) {
  const [pendente, iniciar] = useTransition();
  const { avisar } = useAvisos();
  const idDica = useId();

  async function gravar(valor: boolean): Promise<boolean> {
    const r = await alternarPrazoOculto(chave, valor);
    if (!r.ok) {
      avisar({
        texto: r.erros._form?.[0] ?? "Não foi possível atualizar o prazo.",
        tipo: "erro",
      });
      return false;
    }
    aoAlterar?.(valor);
    return true;
  }

  function alternar() {
    const valor = !oculto;
    iniciar(async () => {
      if (!(await gravar(valor))) return;
      avisar(
        valor
          ? {
              texto: `“${nome}” oculto do dashboard.`,
              chave: `ocultar-${chave}`,
              acao: {
                rotulo: "Desfazer",
                executar: async () => {
                  await gravar(false);
                },
              },
            }
          : { texto: `“${nome}” volta a aparecer no dashboard.`, chave: `ocultar-${chave}` },
      );
    });
  }

  const Icone = pendente ? Loader2 : oculto ? Eye : EyeOff;
  // Fragmento: no rodapé em grade do painel, a dica ocupa a última linha inteira.
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("max-md:h-11", className)}
        onClick={alternar}
        disabled={pendente}
        aria-describedby={oculto ? undefined : idDica}
      >
        <Icone className={pendente ? "motion-safe:animate-spin" : undefined} aria-hidden />
        {oculto ? "Mostrar no dashboard" : "Ocultar do dashboard"}
      </Button>
      {oculto ? null : (
        <p id={idDica} className="order-last col-span-full text-muted-foreground text-xs">
          Ocultar só remove do dashboard; o prazo continua pendente.
        </p>
      )}
    </>
  );
}
