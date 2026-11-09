import { Badge } from "@/components/ui/badge";
import { formatarDataHora } from "@/lib/format";

/**
 * Selo de um token pessoal ativo (#108). O último uso vai no `title` (dica ao passar o mouse) e,
 * para leitores de tela, num texto oculto.
 */
export function SeloToken({ rotulo, usadoEm }: { rotulo: string; usadoEm: Date | null }) {
  const uso = usadoEm ? `usado por último em ${formatarDataHora(usadoEm)}` : "ainda não usado";
  return (
    <Badge variant="outline" title={`${rotulo} ativo, ${uso}`}>
      {rotulo}
      <span className="sr-only">: token ativo, {uso}</span>
    </Badge>
  );
}
