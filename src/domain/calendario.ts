/**
 * Calendário mensal de eventos (RF04/RF06 desejável). Funções puras: sem Next, sem banco e sem
 * relógio — `hoje` (data de calendário em America/Sao_Paulo) é sempre parâmetro. Meses circulam
 * como `AAAA-MM` e dias como `YYYY-MM-DD` (wall-clock de Brasília): sem horário, não há horário de
 * verão nem fuso envolvidos. Semana começando no domingo, como nos calendários brasileiros.
 */
import { type DataISO, diasEntre, ehDataISO } from "../lib/tz";
import {
  type ConcursoPrazo,
  compararPrazos,
  concursoAcompanhado,
  criticidade,
  type EventoPrazo,
  ehTipoCritico,
  type Prazo,
} from "./prazos";

/** Mês de calendário no formato `AAAA-MM`. */
export type MesISO = string;

/** Rótulos curtos dos dias da semana, de domingo a sábado. */
export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** `true` se `valor` é um mês `AAAA-MM` válido (anos 1000–9999). */
export function ehMesISO(valor: string): valor is MesISO {
  const m = RE_MES.exec(valor);
  return m !== null && Number(m[1]) >= 1000;
}

function partes(mes: MesISO): [number, number] {
  if (!ehMesISO(mes)) throw new RangeError(`Mês inválido (esperado AAAA-MM): "${mes}"`);
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  return [ano, m];
}

/** Mês (`AAAA-MM`) de uma data `YYYY-MM-DD`. */
export function mesDaData(data: DataISO): MesISO {
  if (!ehDataISO(data)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${data}"`);
  return data.slice(0, 7);
}

/** Mês pedido na URL (`?mes=AAAA-MM`); ausente ou inválido = mês de `hoje`. */
export function lerMes(valor: unknown, hoje: DataISO): MesISO {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return typeof texto === "string" && ehMesISO(texto) ? texto : mesDaData(hoje);
}

/** Desloca o mês em `n` meses (negativo = para trás). */
export function deslocarMes(mes: MesISO, n: number): MesISO {
  const [ano, m] = partes(mes);
  const total = ano * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${doisDigitos((total % 12) + 1)}`;
}

const ehBissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

/** Quantidade de dias do mês (considera anos bissextos). */
export function diasNoMes(mes: MesISO): number {
  const [ano, m] = partes(mes);
  if (m === 2) return ehBissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export function primeiroDia(mes: MesISO): DataISO {
  partes(mes);
  return `${mes}-01`;
}

export function ultimoDia(mes: MesISO): DataISO {
  return `${mes}-${doisDigitos(diasNoMes(mes))}`;
}

/** Dia da semana (0 = domingo … 6 = sábado) de uma data de calendário, sem depender de fuso. */
export function diaDaSemana(data: DataISO): number {
  if (!ehDataISO(data)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${data}"`);
  const [ano, mes, dia] = data.split("-").map(Number) as [number, number, number];
  const instante = new Date(0);
  instante.setUTCFullYear(ano, mes - 1, dia);
  return instante.getUTCDay();
}

export interface DiaGrade {
  data: DataISO;
  /** Dia do mês (1–31). */
  dia: number;
  /** `false` para os dias dos meses vizinhos que completam a primeira/última semana. */
  doMes: boolean;
  hoje: boolean;
}

/**
 * Grade do mês em semanas completas (domingo a sábado), com os dias dos meses vizinhos
 * completando a primeira e a última semana. Tem de 4 a 6 semanas.
 */
export function montarGradeMes(mes: MesISO, hoje: DataISO): DiaGrade[][] {
  const inicio = primeiroDia(mes);
  const total = diasNoMes(mes);
  const antes = diaDaSemana(inicio);
  const semanas = Math.ceil((antes + total) / 7);
  const anterior = deslocarMes(mes, -1);
  const seguinte = deslocarMes(mes, 1);
  const diasAnterior = diasNoMes(anterior);

  const grade: DiaGrade[][] = [];
  for (let s = 0; s < semanas; s++) {
    const semana: DiaGrade[] = [];
    for (let d = 0; d < 7; d++) {
      const posicao = s * 7 + d - antes + 1;
      let data: DataISO;
      let dia: number;
      if (posicao < 1) {
        dia = diasAnterior + posicao;
        data = `${anterior}-${doisDigitos(dia)}`;
      } else if (posicao > total) {
        dia = posicao - total;
        data = `${seguinte}-${doisDigitos(dia)}`;
      } else {
        dia = posicao;
        data = `${mes}-${doisDigitos(dia)}`;
      }
      semana.push({ data, dia, doMes: posicao >= 1 && posicao <= total, hoje: data === hoje });
    }
    grade.push(semana);
  }
  return grade;
}

/** Item do calendário: um prazo (§4.2) mais o estado visual. */
export type ItemCalendario<
  E extends EventoPrazo = EventoPrazo,
  C extends ConcursoPrazo = ConcursoPrazo,
> = Prazo<E, C> & {
  concluido: boolean;
  /** Esmaecido: evento concluído ou de concurso encerrado (não exige mais ação). */
  esmaecido: boolean;
};

/**
 * Itens do calendário entre `inicio` e `fim` (inclusive), por data e hora (mesma ordenação do
 * painel). Diferente do painel, inclui eventos concluídos e de concursos encerrados (esmaecidos),
 * para o calendário servir também de registro. Destaques como no painel: só itens pendentes de
 * concursos acompanhados recebem criticidade; o pseudo-evento de fim de validade (§4.3) entra para
 * concursos acompanhados sem evento `VALIDADE` explícito. Eventos de concursos ausentes em
 * `concursos` ou com data inválida são ignorados.
 */
export function itensCalendario<E extends EventoPrazo, C extends ConcursoPrazo>(
  eventos: readonly E[],
  concursos: readonly C[],
  inicio: DataISO,
  fim: DataISO,
  hoje: DataISO,
): ItemCalendario<E, C>[] {
  for (const d of [inicio, fim, hoje]) {
    if (!ehDataISO(d)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${d}"`);
  }
  const porId = new Map(concursos.map((c) => [c.id, c]));
  const noPeriodo = (data: string) => ehDataISO(data) && data >= inicio && data <= fim;
  const itens: ItemCalendario<E, C>[] = [];
  const comValidadeExplicita = new Set<number>();

  for (const e of eventos) {
    if (e.tipo === "VALIDADE") comValidadeExplicita.add(e.concursoId);
    const concurso = porId.get(e.concursoId);
    if (!concurso || !noPeriodo(e.data)) continue;
    const esmaecido = e.concluido || !concursoAcompanhado(concurso.status);
    const dias = diasEntre(hoje, e.data);
    itens.push({
      chave: `evento-${e.id}`,
      evento: e,
      concurso,
      tipo: e.tipo,
      titulo: e.titulo,
      data: e.data,
      hora: e.hora,
      dias,
      critico: ehTipoCritico(e.tipo),
      criticidade: esmaecido ? "NORMAL" : criticidade(e.tipo, dias),
      derivado: false,
      concluido: e.concluido,
      esmaecido,
    });
  }

  for (const concurso of concursos) {
    const fimValidade = concurso.validadeFim;
    if (
      !fimValidade ||
      !noPeriodo(fimValidade) ||
      !concursoAcompanhado(concurso.status) ||
      comValidadeExplicita.has(concurso.id)
    ) {
      continue;
    }
    const dias = diasEntre(hoje, fimValidade);
    itens.push({
      chave: `validade-${concurso.id}`,
      evento: null,
      concurso,
      tipo: "VALIDADE",
      titulo: null,
      data: fimValidade,
      hora: null,
      dias,
      critico: false,
      criticidade: criticidade("VALIDADE", dias),
      derivado: true,
      concluido: false,
      esmaecido: false,
    });
  }

  return itens.sort(compararPrazos);
}

/** Agrupa itens (já ordenados) por data, preservando a ordem. */
export function agruparPorData<T extends { data: DataISO }>(
  itens: readonly T[],
): Map<DataISO, T[]> {
  const grupos = new Map<DataISO, T[]>();
  for (const item of itens) {
    const lista = grupos.get(item.data);
    if (lista) lista.push(item);
    else grupos.set(item.data, [item]);
  }
  return grupos;
}
