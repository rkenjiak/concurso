/**
 * Pendências de status (#65, #85, ARQUITETURA.md §4.1): quando um evento importante chega ou passa,
 * o app pergunta o que aconteceu e oferece respostas de um clique. Nunca muda o status sozinho:
 * responder usa a transição validada (`domain/status`) e grava o histórico. Função pura: `hoje`
 * (data de calendário em America/Sao_Paulo) é parâmetro.
 *
 * "Chegou" = concluído ou `data <= hoje`; "passou" = concluído ou `data < hoje`.
 *
 * | Regra            | Status                         | Evento                                 | Respostas                              |
 * |------------------|--------------------------------|----------------------------------------|----------------------------------------|
 * | `POSSE`          | Nomeado                        | Posse chegou                           | Sim → Empossado · Não → Desistiu       |
 * | `NOMEACAO`       | Aprovado, Classificado         | Convocação/nomeação/posse chegou       | Sim → Nomeado                          |
 * | `RESULTADO`      | Prova realizada, Aguardando    | Resultado final chegou                 | Aprovado · Classificado · Reprovado    |
 * | `RECURSO`        | Prova realizada                | Recurso posterior à prova passou       | Sim → Aguardando resultado             |
 * | `PROVA`          | Inscrito, Prova agendada       | Prova objetiva/discursiva passou⁴      | Sim → Prova realizada¹ · Não → Desistiu|
 * | `BOLETO`         | Previsto, Edital, Inscrito     | Vencimento do boleto passou (pendente) | Sim → Inscrito² · Não → Não inscrito³  |
 * | `PROVA_AGENDADA` | Inscrito                       | Prova futura cadastrada                | Sim → Prova agendada                   |
 * | `INSCRICAO`      | Previsto, Edital publicado     | Fim das inscrições passou              | Sim → Inscrito · Não → Não inscrito    |
 * | `EDITAL`         | Previsto                       | Publicação do edital chegou            | Sim → Edital publicado                 |
 *
 * ¹ Ou "Aguardando resultado", se o recurso posterior à prova também já terminou.
 * ² Já inscrito: "Sim" mantém o status e marca o boleto como concluído.
 * ³ Já inscrito: "Não paguei, desisti" → Desistiu (a trilha não permite voltar de Inscrito para
 *   Não inscrito). Quem ainda vai pagar usa "Lembrar depois".
 * ⁴ A partir do dia seguinte: no próprio dia a prova pode não ter acontecido ainda.
 *
 * Respostas que levam a Desistiu (status final) pedem confirmação na UI (`confirmar`).
 *
 * As pendências saem na ordem da tabela (etapa mais adiantada primeiro); a UI mostra a primeira
 * que não foi dispensada nem adiada ("lembrar depois").
 */
import { type DataISO, ehDataISO } from "../lib/tz";
import type { Status, TipoEvento } from "./enums";
import {
  dataBr,
  type EventoChave,
  eventoPassou,
  eventosDosTipos,
  proximoEvento,
  TIPOS_PROVA,
  ultimoEvento,
} from "./eventos-chave";
import { nomePrazo } from "./prazos";
import { podeTransicionar } from "./status";

export const REGRAS_PENDENCIA = [
  "POSSE",
  "NOMEACAO",
  "RESULTADO",
  "RECURSO",
  "PROVA",
  "BOLETO",
  "PROVA_AGENDADA",
  "INSCRICAO",
  "EDITAL",
] as const;
export type RegraPendencia = (typeof REGRAS_PENDENCIA)[number];

/** Tipos de evento usados pelas regras (para filtrar a consulta). */
export const TIPOS_PENDENCIA = [
  "PUBLICACAO_EDITAL",
  "FIM_INSCRICOES",
  "VENCIMENTO_BOLETO",
  "PROVA_OBJETIVA",
  "PROVA_DISCURSIVA",
  "PRAZO_RECURSO",
  "RESULTADO_FINAL",
  "CONVOCACAO",
  "NOMEACAO",
  "POSSE",
] as const satisfies readonly TipoEvento[];

/** "Lembrar depois" esconde a pendência por este número de dias. */
export const DIAS_LEMBRAR_DEPOIS = 3;

export interface RespostaPendencia {
  /** Identificador estável dentro da pendência (`sim`, `nao`, `aprovado`…). */
  id: string;
  rotulo: string;
  /** Novo status; `null` mantém o atual. */
  para: Status | null;
  /** Marca o evento da pendência como concluído (ex.: boleto pago). */
  concluirEvento: boolean;
  /** Texto de confirmação antes de aplicar (respostas que levam a um status final). */
  confirmar?: string;
}

export interface PendenciaStatus {
  /** `<regra>-<eventoId>`: identifica a pendência para responder e dispensar. */
  chave: string;
  regra: RegraPendencia;
  eventoId: number;
  /** Data do evento quando a pendência surgiu: se o evento mudar de data, a dispensa caduca. */
  dataEvento: DataISO;
  pergunta: string;
  /** Explicação em pt-BR ("Prova objetiva foi em 08/11/2026."). */
  motivo: string;
  respostas: RespostaPendencia[];
}

/** Dispensa ("não perguntar mais") ou adiamento ("lembrar depois") de uma pendência. */
export interface DispensaPendencia {
  regra: RegraPendencia;
  eventoId: number;
  dataEvento: DataISO;
  /** `null` = dispensada; data = volta a aparecer a partir desse dia. */
  ate: DataISO | null;
}

const sim = (para: Status | null, concluirEvento = false): RespostaPendencia => ({
  id: "sim",
  rotulo: "Sim",
  para,
  concluirEvento,
});
const nao = (para: Status, rotulo = "Não"): RespostaPendencia => ({
  id: "nao",
  rotulo,
  para,
  concluirEvento: false,
  ...(para === "DESISTIU"
    ? { confirmar: "Marcar como Desistiu? O concurso sai das contagens e pendências." }
    : {}),
});

function chegou(e: EventoChave, hoje: DataISO): string {
  const d = dataBr(e.data);
  if (e.data === hoje) return `${nomePrazo(e)} é hoje (${d}).`;
  if (e.data < hoje) return `${nomePrazo(e)} foi em ${d}.`;
  return `${nomePrazo(e)} (${d}) está concluído.`;
}

function passou(e: EventoChave, hoje: DataISO): string {
  const d = dataBr(e.data);
  if (e.data < hoje) return `${nomePrazo(e)} em ${d} já passou.`;
  return `${nomePrazo(e)} (${d}) está concluído.`;
}

function pendencia(
  regra: RegraPendencia,
  e: EventoChave,
  pergunta: string,
  motivo: string,
  respostas: RespostaPendencia[],
): PendenciaStatus {
  return {
    chave: `${regra}-${e.id}`,
    regra,
    eventoId: e.id,
    dataEvento: e.data,
    pergunta,
    motivo,
    respostas,
  };
}

const em = (status: Status, ...lista: Status[]) => lista.includes(status);

/** Pendências do concurso na ordem de prioridade (vazia se nenhuma regra se aplica). */
export function pendenciasStatus(
  status: Status,
  eventos: readonly EventoChave[],
  hoje: DataISO,
): PendenciaStatus[] {
  if (!ehDataISO(hoje)) throw new RangeError(`Data inválida (esperado YYYY-MM-DD): "${hoje}"`);
  const lista: PendenciaStatus[] = [];
  const ultimo = (tipos: readonly TipoEvento[], incluirHoje = true) =>
    ultimoEvento(eventos, tipos, hoje, { incluirHoje })?.evento;

  // Recurso posterior à primeira prova que já passou (o anterior, ex. contra a isenção, não conta).
  const provasPassadas = eventosDosTipos(eventos, TIPOS_PROVA).filter((e) => eventoPassou(e, hoje));
  const primeiraProva = provasPassadas[0];
  const recurso = primeiraProva
    ? eventosDosTipos(eventos, ["PRAZO_RECURSO"])
        .filter((e) => eventoPassou(e, hoje) && e.data >= primeiraProva.data)
        .at(-1)
    : undefined;

  if (status === "NOMEADO") {
    const posse = ultimo(["POSSE"]);
    if (posse) {
      lista.push(
        pendencia("POSSE", posse, "Tomou posse?", chegou(posse, hoje), [
          sim("EMPOSSADO"),
          nao("DESISTIU", "Não, desisti"),
        ]),
      );
    }
  }

  if (em(status, "APROVADO", "CLASSIFICADO")) {
    const nomeacao = ultimo(["CONVOCACAO", "NOMEACAO", "POSSE"]);
    if (nomeacao) {
      lista.push(
        pendencia("NOMEACAO", nomeacao, "Foi nomeado?", chegou(nomeacao, hoje), [sim("NOMEADO")]),
      );
    }
  }

  if (em(status, "PROVA_REALIZADA", "AGUARDANDO_RESULTADO")) {
    const resultado = ultimo(["RESULTADO_FINAL"]);
    if (resultado) {
      lista.push(
        pendencia("RESULTADO", resultado, "Qual foi o resultado?", chegou(resultado, hoje), [
          { id: "aprovado", rotulo: "Aprovado", para: "APROVADO", concluirEvento: false },
          {
            id: "classificado",
            rotulo: "Classificado",
            para: "CLASSIFICADO",
            concluirEvento: false,
          },
          { id: "reprovado", rotulo: "Reprovado", para: "REPROVADO", concluirEvento: false },
        ]),
      );
    }
  }

  if (status === "PROVA_REALIZADA" && recurso) {
    lista.push(
      pendencia(
        "RECURSO",
        recurso,
        "Mudar para Aguardando resultado?",
        `${nomePrazo(recurso)} até ${dataBr(recurso.data)} já terminou.`,
        [sim("AGUARDANDO_RESULTADO")],
      ),
    );
  }

  if (em(status, "INSCRITO", "PROVA_AGENDADA")) {
    // Só depois do dia da prova: no próprio dia ela pode ainda não ter acontecido.
    const prova = ultimo(TIPOS_PROVA, false);
    if (prova) {
      lista.push(
        pendencia("PROVA", prova, "Fez a prova?", chegou(prova, hoje), [
          sim(recurso ? "AGUARDANDO_RESULTADO" : "PROVA_REALIZADA"),
          nao("DESISTIU", "Não, desisti"),
        ]),
      );
    }
  }

  if (em(status, "PREVISTO", "EDITAL_PUBLICADO", "INSCRITO")) {
    const boleto = eventosDosTipos(eventos, ["VENCIMENTO_BOLETO"])
      .filter((e) => !e.concluido && e.data < hoje)
      .at(-1);
    if (boleto) {
      const inscrito = status === "INSCRITO";
      lista.push(
        pendencia("BOLETO", boleto, "Pagou o boleto?", passou(boleto, hoje), [
          sim(inscrito ? null : "INSCRITO", true),
          inscrito ? nao("DESISTIU", "Não paguei, desisti") : nao("NAO_INSCRITO"),
        ]),
      );
    }
  }

  if (status === "INSCRITO") {
    const proxima = proximoEvento(eventos, TIPOS_PROVA, hoje);
    if (proxima && proxima.dias > 0) {
      const e = proxima.evento;
      lista.push(
        pendencia(
          "PROVA_AGENDADA",
          e,
          "Mudar para Prova agendada?",
          `${nomePrazo(e)} marcada para ${dataBr(e.data)}.`,
          [sim("PROVA_AGENDADA")],
        ),
      );
    }
  }

  if (em(status, "PREVISTO", "EDITAL_PUBLICADO")) {
    const fim = ultimo(["FIM_INSCRICOES"], false);
    if (fim) {
      lista.push(
        pendencia("INSCRICAO", fim, "Você se inscreveu?", passou(fim, hoje), [
          sim("INSCRITO"),
          nao("NAO_INSCRITO"),
        ]),
      );
    }
  }

  if (status === "PREVISTO") {
    const edital = ultimo(["PUBLICACAO_EDITAL"]);
    if (edital) {
      lista.push(
        pendencia("EDITAL", edital, "O edital saiu?", chegou(edital, hoje), [
          sim("EDITAL_PUBLICADO"),
        ]),
      );
    }
  }

  // Salvaguarda: só respostas com transição permitida (ou que mantêm o status).
  return lista
    .map((p) => ({
      ...p,
      respostas: p.respostas.filter((r) => r.para === null || podeTransicionar(status, r.para)),
    }))
    .filter((p) => p.respostas.length > 0);
}

/** A pendência está dispensada, ou adiada até depois de `hoje`. */
export function pendenciaDispensada(
  p: Pick<PendenciaStatus, "regra" | "eventoId" | "dataEvento">,
  dispensas: readonly DispensaPendencia[],
  hoje: DataISO,
): boolean {
  return dispensas.some(
    (d) =>
      d.regra === p.regra &&
      d.eventoId === p.eventoId &&
      d.dataEvento === p.dataEvento &&
      (d.ate === null || hoje < d.ate),
  );
}

/** Primeira pendência não dispensada nem adiada, ou `null`. */
export function proximaPendencia(
  status: Status,
  eventos: readonly EventoChave[],
  hoje: DataISO,
  dispensas: readonly DispensaPendencia[] = [],
): PendenciaStatus | null {
  return (
    pendenciasStatus(status, eventos, hoje).find((p) => !pendenciaDispensada(p, dispensas, hoje)) ??
    null
  );
}

/** Interpreta a {@link PendenciaStatus.chave} (`<regra>-<eventoId>`); `null` se inválida. */
export function lerChavePendencia(
  chave: unknown,
): { regra: RegraPendencia; eventoId: number } | null {
  if (typeof chave !== "string") return null;
  const m = /^([A-Z_]+)-([1-9]\d{0,15})$/.exec(chave);
  if (!m) return null;
  const regra = m[1] as RegraPendencia;
  const eventoId = Number(m[2]);
  if (!REGRAS_PENDENCIA.includes(regra) || !Number.isSafeInteger(eventoId)) return null;
  return { regra, eventoId };
}

/** Observação gravada no histórico ao responder ("Pendência: Fez a prova? Sim. …"). */
export function observacaoResposta(p: PendenciaStatus, r: RespostaPendencia): string {
  return `Pendência: ${p.pergunta} ${r.rotulo}. ${p.motivo}`;
}
