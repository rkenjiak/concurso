import { Badge } from "@/components/ui/badge";
import type { Status } from "@/domain/enums";
import { DESCRICAO_STATUS, ROTULO_STATUS } from "@/domain/labels";
import { ehTerminal } from "@/domain/status";
import { cn } from "@/lib/utils";

const COR: Partial<Record<Status, string>> = {
  APROVADO: "bg-emerald-600 text-white",
  CLASSIFICADO: "bg-sky-600 text-white",
  NOMEADO: "bg-emerald-700 text-white",
  EMPOSSADO: "bg-emerald-800 text-white",
  REPROVADO: "bg-destructive/10 text-destructive",
  SUSPENSO: "bg-aviso/15 text-aviso-foreground",
};

export function BadgeStatus({ status, className }: { status: Status; className?: string }) {
  const cor = COR[status];
  return (
    <Badge
      variant={cor ? "default" : ehTerminal(status) ? "outline" : "secondary"}
      className={cn(cor, className)}
      title={DESCRICAO_STATUS[status]}
    >
      {ROTULO_STATUS[status]}
    </Badge>
  );
}
