/**
 * Agrupamento por dia relativo a `hoje` (#104): "Hoje", "Ontem" e "Anteriores". Usado pela
 * central de notificações para separar os avisos pelo dia em que foram disparados. `hoje` vem
 * sempre do servidor (`hojeSP()`), nunca do relógio do cliente.
 */
import { type DataISO, somarDias } from "./tz";

export type ChaveGrupoDia = "hoje" | "ontem" | "anteriores";

export interface GrupoDia<T> {
  chave: ChaveGrupoDia;
  rotulo: string;
  itens: T[];
}

const ROTULOS: Record<ChaveGrupoDia, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  anteriores: "Anteriores",
};

/** Grupo de uma data em relação a `hoje`; datas futuras contam como "hoje". */
export function grupoDoDia(data: DataISO, hoje: DataISO): ChaveGrupoDia {
  if (data >= hoje) return "hoje";
  if (data === somarDias(hoje, -1)) return "ontem";
  return "anteriores";
}

/**
 * Separa `itens` em "Hoje", "Ontem" e "Anteriores" (nesta ordem), mantendo a ordem original
 * dentro de cada grupo. Grupos vazios são omitidos.
 */
export function agruparPorDia<T>(
  itens: readonly T[],
  dataDe: (item: T) => DataISO,
  hoje: DataISO,
): GrupoDia<T>[] {
  const grupos: Record<ChaveGrupoDia, T[]> = { hoje: [], ontem: [], anteriores: [] };
  for (const item of itens) grupos[grupoDoDia(dataDe(item), hoje)].push(item);
  return (Object.keys(ROTULOS) as ChaveGrupoDia[])
    .filter((chave) => grupos[chave].length > 0)
    .map((chave) => ({ chave, rotulo: ROTULOS[chave], itens: grupos[chave] }));
}
