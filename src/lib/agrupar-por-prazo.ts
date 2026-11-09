/**
 * Agrupamento das notificações pela proximidade do prazo (#104): "Hoje e amanhã" (0–1 dia),
 * "Próximos 7 dias" (2–7) e "Mais adiante" (8+). Agrupa pelo prazo, não pelo dia de disparo:
 * `disparadaEm = data − antecedência vigente`, então "Prova é hoje" (regra 7, 1) teria sido
 * disparada ontem, e um prazo cadastrado hoje para daqui a 3 dias (antecedência 7) já nasceria
 * "antigo". Os `dias` vêm do domínio, calculados com o `hoje` do servidor (`hojeSP()`).
 */

export type ChaveGrupoPrazo = "hoje-amanha" | "proximos-7" | "mais-adiante";

export interface GrupoPrazo<T> {
  chave: ChaveGrupoPrazo;
  rotulo: string;
  itens: T[];
}

/** O mínimo para agrupar e ordenar: dias até o prazo, data (`YYYY-MM-DD`) e hora (`HH:mm`). */
export interface PrazoAgrupavel {
  dias: number;
  data: string;
  hora: string | null;
}

const ROTULOS: Record<ChaveGrupoPrazo, string> = {
  "hoje-amanha": "Hoje e amanhã",
  "proximos-7": "Próximos 7 dias",
  "mais-adiante": "Mais adiante",
};

/** Grupo de um prazo a `dias` dias de hoje; vencidos (negativos) contam como "Hoje e amanhã". */
export function grupoDoPrazo(dias: number): ChaveGrupoPrazo {
  if (dias <= 1) return "hoje-amanha";
  if (dias <= 7) return "proximos-7";
  return "mais-adiante";
}

/** Ordem do prazo: data, depois hora (sem hora primeiro: vale o dia todo, como no domínio). */
function compararPrazo(a: PrazoAgrupavel, b: PrazoAgrupavel): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  if (a.hora === b.hora) return 0;
  if (a.hora === null) return -1;
  if (b.hora === null) return 1;
  return a.hora < b.hora ? -1 : 1;
}

/**
 * Separa `itens` em "Hoje e amanhã", "Próximos 7 dias" e "Mais adiante" (nesta ordem), omitindo
 * grupos vazios. Dentro de cada grupo, o prazo mais próximo primeiro (data e hora); empates
 * mantêm a ordem recebida.
 */
export function agruparPorPrazo<T extends PrazoAgrupavel>(itens: readonly T[]): GrupoPrazo<T>[] {
  const grupos: Record<ChaveGrupoPrazo, T[]> = {
    "hoje-amanha": [],
    "proximos-7": [],
    "mais-adiante": [],
  };
  for (const item of itens) grupos[grupoDoPrazo(item.dias)].push(item);
  return (Object.keys(ROTULOS) as ChaveGrupoPrazo[])
    .filter((chave) => grupos[chave].length > 0)
    .map((chave) => ({ chave, rotulo: ROTULOS[chave], itens: grupos[chave].sort(compararPrazo) }));
}
