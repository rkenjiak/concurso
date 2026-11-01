import { Badge } from "@/components/ui/badge";
import {
  type DadosValidade,
  DIAS_ALERTA_VALIDADE,
  descreverValidade,
  type SituacaoValidade,
  situacaoValidade,
} from "@/domain/validade";
import { formatarData } from "@/lib/format";
import type { DataISO } from "@/lib/tz";
import { cn } from "@/lib/utils";

const ROTULO: Readonly<Record<SituacaoValidade, string>> = {
  INDEFINIDA: "Não definida",
  VIGENTE: "Vigente",
  VENCENDO: "Vencendo",
  EXPIRADA: "Expirada",
};

const COR: Readonly<Record<SituacaoValidade, string>> = {
  INDEFINIDA: "",
  VIGENTE: "bg-emerald-600 text-white",
  VENCENDO: "bg-aviso/15 text-aviso-foreground",
  EXPIRADA: "bg-destructive/10 text-destructive",
};

/** Validade do concurso (§4.3): fim, origem do cálculo e dias restantes em relação a `hoje`. */
export function ValidadeConcurso({ dados, hoje }: { dados: DadosValidade; hoje: DataISO }) {
  const v = situacaoValidade(dados, hoje);

  if (v.fim === null) {
    return (
      <p className="text-muted-foreground text-sm">
        Validade não definida. Informe a data da homologação e o prazo em meses (ou o fim da
        validade) em “Editar”.
      </p>
    );
  }

  const origem =
    v.origem === "MANUAL"
      ? "Data informada manualmente."
      : `Homologação em ${formatarData(dados.homologacaoData)} + ${dados.validadeMeses} ${
          dados.validadeMeses === 1 ? "mês" : "meses"
        }${dados.validadeProrrogada ? ", prorrogada por igual período" : ""}.`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Até {formatarData(v.fim)}</span>
        <Badge
          variant={v.situacao === "INDEFINIDA" ? "outline" : "default"}
          className={cn(COR[v.situacao])}
        >
          {ROTULO[v.situacao]}
        </Badge>
        <span className="text-muted-foreground text-sm">{descreverValidade(v)}</span>
      </div>
      <p className="text-muted-foreground text-xs">{origem}</p>
      {v.situacao === "VENCENDO" ? (
        <p role="status" className="text-aviso-foreground text-sm">
          Faltam {DIAS_ALERTA_VALIDADE} dias ou menos: acompanhe as convocações.
        </p>
      ) : null}
    </div>
  );
}
