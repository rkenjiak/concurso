/**
 * Quadro (kanban) por status (RF06 desejável, ARQUITETURA.md §5.1). Funções puras: sem Next, sem
 * banco. Mover um cartão é uma troca de status comum — as regras continuam em `status.ts`.
 */
import { STATUS, type Status } from "./enums";
import { STATUS_RESULTADO, TRILHA_PRINCIPAL } from "./status";

/**
 * Colunas principais do quadro, na ordem do pipeline: trilha principal, resultados em aberto
 * (`APROVADO`, `CLASSIFICADO`) e `NOMEADO`.
 */
export const COLUNAS_PRINCIPAIS = [
  ...TRILHA_PRINCIPAL,
  ...STATUS_RESULTADO.filter((s) => s !== "REPROVADO"),
  "NOMEADO",
] as const satisfies readonly Status[];

/**
 * Status agrupados em uma coluna recolhível (encerrados e suspensos), para o quadro não ficar
 * largo demais: os demais status, na ordem do enum.
 */
export const COLUNAS_AGRUPADAS: readonly Status[] = STATUS.filter(
  (s) => !(COLUNAS_PRINCIPAIS as readonly Status[]).includes(s),
);

export interface ColunaQuadro<T> {
  status: Status;
  itens: T[];
}

export interface Quadro<T> {
  principais: ColunaQuadro<T>[];
  agrupadas: ColunaQuadro<T>[];
  /** Total de itens nas colunas agrupadas. */
  totalAgrupadas: number;
}

/**
 * Distribui os itens nas colunas pelo status, preservando a ordem de entrada dentro de cada
 * coluna. Todas as colunas aparecem, mesmo vazias (são alvos para soltar cartões).
 */
export function montarQuadro<T extends { status: Status }>(itens: readonly T[]): Quadro<T> {
  const porStatus = Object.fromEntries(STATUS.map((s) => [s, [] as T[]])) as Record<Status, T[]>;
  for (const item of itens) porStatus[item.status].push(item);
  const coluna = (status: Status): ColunaQuadro<T> => ({ status, itens: porStatus[status] });
  const agrupadas = COLUNAS_AGRUPADAS.map(coluna);
  return {
    principais: COLUNAS_PRINCIPAIS.map(coluna),
    agrupadas,
    totalAgrupadas: agrupadas.reduce((n, c) => n + c.itens.length, 0),
  };
}
