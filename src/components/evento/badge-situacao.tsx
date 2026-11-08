import { COR_URGENCIA } from "@/components/evento/urgencia";
import { Badge } from "@/components/ui/badge";
import { ROTULO_SITUACAO, type SituacaoPrazo } from "@/domain/prazos";

const ESTILO_SITUACAO: Readonly<
  Record<SituacaoPrazo, { variant: "destructive" | "secondary" | "outline"; className?: string }>
> = {
  CONCLUIDO: { variant: "secondary" },
  VENCIDO: { variant: "destructive" },
  URGENTE: { variant: "destructive" },
  ESTA_SEMANA: { variant: "secondary", className: COR_URGENCIA.MEDIA.fundo },
  CRITICO: { variant: "outline" },
};

/**
 * Badge único da situação de um prazo (#100, D11), igual no dashboard, no calendário e no painel
 * do evento. A regra fica em {@link situacaoPrazo}; `null` não renderiza nada.
 */
export function BadgeSituacao({ situacao }: { situacao: SituacaoPrazo | null }) {
  if (!situacao) return null;
  const { variant, className } = ESTILO_SITUACAO[situacao];
  return (
    <Badge variant={variant} className={className} data-situacao={situacao}>
      {ROTULO_SITUACAO[situacao]}
    </Badge>
  );
}
