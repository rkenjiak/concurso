/**
 * Sugestão do próximo status quando um evento-chave passa (#65, ARQUITETURA.md §4.1). Só sugere:
 * nunca muda o status sozinho; aplicar usa a transição validada (`domain/status`) e grava o
 * histórico. Função pura: `hoje` (data de calendário em America/Sao_Paulo) é parâmetro.
 *
 * Regras (só para concursos na trilha principal, a partir de "Inscrito"):
 * - Inscrito, com prova (objetiva/discursiva) marcada para hoje ou depois → "Prova agendada".
 * - Prova já passou (data anterior a hoje ou evento concluído) → "Prova realizada".
 * - Prova passou e o prazo de recurso posterior a ela também → "Aguardando resultado".
 * Vale a sugestão mais adiantada que seja uma transição permitida a partir do status atual.
 */
import { type DataISO, ehDataISO } from "../lib/tz";
import type { Status, TipoEvento } from "./enums";
import { ROTULO_TIPO_EVENTO } from "./labels";
import { podeTransicionar, posicaoNaTrilha } from "./status";

export interface EventoSugestao {
  id: number;
  tipo: TipoEvento;
  titulo: string | null;
  data: DataISO;
  concluido: boolean;
}

export interface SugestaoStatus {
  para: Status;
  /** Explicação em pt-BR ("Prova objetiva em 12/10/2026 já passou."). */
  motivo: string;
  /** Evento que motivou a sugestão. */
  eventoId: number;
}

const TIPOS_PROVA: readonly TipoEvento[] = ["PROVA_OBJETIVA", "PROVA_DISCURSIVA"];

const dataBr = (data: DataISO) => data.split("-").reverse().join("/");
const nome = (e: EventoSugestao) => e.titulo ?? ROTULO_TIPO_EVENTO[e.tipo];

/** Sugestão para o concurso, ou `null`. */
export function sugerirStatus(
  status: Status,
  eventos: readonly EventoSugestao[],
  hoje: DataISO,
): SugestaoStatus | null {
  if (!ehDataISO(hoje)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${hoje}"`);
  const posicao = posicaoNaTrilha(status);
  if (posicao < posicaoNaTrilha("INSCRITO")) return null;

  const validos = eventos.filter((e) => ehDataISO(e.data));
  const passou = (e: EventoSugestao) => e.concluido || e.data < hoje;
  const porData = (a: EventoSugestao, b: EventoSugestao) =>
    a.data < b.data ? -1 : a.data > b.data ? 1 : a.id - b.id;

  const provas = validos.filter((e) => TIPOS_PROVA.includes(e.tipo)).sort(porData);
  const provasPassadas = provas.filter(passou);
  const primeiraProva = provasPassadas[0];
  const ultimaProva = provasPassadas.at(-1);

  const candidatos: SugestaoStatus[] = [];
  if (primeiraProva && ultimaProva) {
    const recurso = validos
      .filter((e) => e.tipo === "PRAZO_RECURSO" && passou(e) && e.data >= primeiraProva.data)
      .sort(porData)
      .at(-1);
    if (recurso) {
      candidatos.push({
        para: "AGUARDANDO_RESULTADO",
        motivo: `${nome(recurso)} até ${dataBr(recurso.data)} já terminou.`,
        eventoId: recurso.id,
      });
    }
    candidatos.push({
      para: "PROVA_REALIZADA",
      motivo: `${nome(ultimaProva)} em ${dataBr(ultimaProva.data)} já passou.`,
      eventoId: ultimaProva.id,
    });
  }
  const proximaProva = provas.find((e) => !passou(e));
  if (status === "INSCRITO" && proximaProva) {
    candidatos.push({
      para: "PROVA_AGENDADA",
      motivo: `${nome(proximaProva)} marcada para ${dataBr(proximaProva.data)}.`,
      eventoId: proximaProva.id,
    });
  }

  return (
    candidatos.find((c) => posicaoNaTrilha(c.para) > posicao && podeTransicionar(status, c.para)) ??
    null
  );
}
