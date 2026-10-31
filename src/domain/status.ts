/**
 * Transições de status do concurso (RF03, ARQUITETURA.md §4.1). Funções puras: sem Next, sem banco.
 */
import { STATUS, type Status } from "./enums";
import { ErroDominio } from "./erros";
import { ROTULO_STATUS } from "./labels";

/** Trilha principal, em ordem: de qualquer etapa pode-se avançar para qualquer etapa posterior. */
export const TRILHA_PRINCIPAL = [
  "PREVISTO",
  "EDITAL_PUBLICADO",
  "INSCRITO",
  "PROVA_AGENDADA",
  "PROVA_REALIZADA",
  "AGUARDANDO_RESULTADO",
] as const satisfies readonly Status[];

/** Status de resultado: podem ser revistos entre si (ex.: após recurso). */
export const STATUS_RESULTADO = [
  "APROVADO",
  "CLASSIFICADO",
  "REPROVADO",
] as const satisfies readonly Status[];

/** Status terminais. `REPROVADO` só sai por revisão de resultado. */
export const STATUS_TERMINAIS = [
  "EMPOSSADO",
  "DESISTIU",
  "NAO_INSCRITO",
  "CANCELADO",
  "REPROVADO",
] as const satisfies readonly Status[];

/** Informações do histórico necessárias para algumas transições. */
export interface ContextoTransicao {
  /** Status imediatamente anterior à suspensão (para retomar um concurso `SUSPENSO`). */
  statusAntesSuspensao?: Status | null;
}

/** Registro mínimo do histórico de status (`status_historico`). */
export interface RegistroHistorico {
  de: Status | null;
  para: Status;
}

function contem<T extends string>(lista: readonly T[], valor: string): valor is T {
  return (lista as readonly string[]).includes(valor);
}

/** Posição (0-based) na trilha principal, ou -1 se o status não faz parte dela. */
export function posicaoNaTrilha(status: Status): number {
  return (TRILHA_PRINCIPAL as readonly Status[]).indexOf(status);
}

export function ehTerminal(status: Status): boolean {
  return contem(STATUS_TERMINAIS, status);
}

/** Ativo = não terminal (inclui `SUSPENSO`, que pode ser retomado). */
export function ehAtivo(status: Status): boolean {
  return !ehTerminal(status);
}

/** Status para os quais `de` pode transicionar, na ordem do enum `STATUS`. */
export function transicoesPermitidas(de: Status, contexto: ContextoTransicao = {}): Status[] {
  const destinos = new Set<Status>();
  const posicao = posicaoNaTrilha(de);

  if (posicao >= 0) {
    for (const s of TRILHA_PRINCIPAL.slice(posicao + 1)) destinos.add(s);
  }
  if (de === "PREVISTO" || de === "EDITAL_PUBLICADO") destinos.add("NAO_INSCRITO");
  if (posicao >= posicaoNaTrilha("INSCRITO")) destinos.add("DESISTIU");
  if (de === "PROVA_REALIZADA" || de === "AGUARDANDO_RESULTADO" || contem(STATUS_RESULTADO, de)) {
    for (const s of STATUS_RESULTADO) destinos.add(s);
  }
  if (de === "APROVADO" || de === "CLASSIFICADO") {
    destinos.add("NOMEADO");
    destinos.add("DESISTIU");
  }
  if (de === "NOMEADO") {
    destinos.add("EMPOSSADO");
    destinos.add("DESISTIU");
  }
  if (de === "SUSPENSO") {
    const anterior = contexto.statusAntesSuspensao;
    if (anterior && anterior !== "SUSPENSO") destinos.add(anterior);
    destinos.add("CANCELADO");
  } else if (!ehTerminal(de)) {
    destinos.add("SUSPENSO");
    destinos.add("CANCELADO");
  }

  destinos.delete(de);
  return STATUS.filter((s) => destinos.has(s));
}

export function podeTransicionar(
  de: Status,
  para: Status,
  contexto: ContextoTransicao = {},
): boolean {
  return transicoesPermitidas(de, contexto).includes(para);
}

/** Lança {@link ErroDominio} se a transição não for permitida. */
export function exigirTransicao(de: Status, para: Status, contexto: ContextoTransicao = {}): void {
  if (!podeTransicionar(de, para, contexto)) {
    throw new ErroDominio(
      `Não é possível mudar o status de "${ROTULO_STATUS[de]}" para "${ROTULO_STATUS[para]}".`,
    );
  }
}

/**
 * Status anterior à suspensão mais recente, dado o histórico em ordem cronológica.
 * `null` se não houver suspensão registrada ou se o concurso já foi criado suspenso.
 */
export function statusAntesDaSuspensao(historico: readonly RegistroHistorico[]): Status | null {
  for (let i = historico.length - 1; i >= 0; i--) {
    const registro = historico[i];
    if (registro?.para === "SUSPENSO") return registro.de;
  }
  return null;
}

/** Contexto de transição derivado do histórico (ordem cronológica). */
export function contextoDoHistorico(historico: readonly RegistroHistorico[]): ContextoTransicao {
  return { statusAntesSuspensao: statusAntesDaSuspensao(historico) };
}

/**
 * A última mudança pode ser desfeita se existir e não for o registro de criação (`de = null`).
 * Desfazer ignora as regras de transição: apenas restaura o `de` do último registro.
 */
export function podeDesfazer(ultimo: RegistroHistorico | null | undefined): boolean {
  return ultimo?.de != null;
}

/** Status restaurado ao desfazer `ultimo`. Lança {@link ErroDominio} se não houver o que desfazer. */
export function statusAoDesfazer(ultimo: RegistroHistorico | null | undefined): Status {
  if (!ultimo || ultimo.de == null) {
    throw new ErroDominio("Não há mudança de status para desfazer.");
  }
  return ultimo.de;
}
