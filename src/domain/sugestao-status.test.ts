import { describe, expect, it } from "vitest";
import { STATUS, type Status, type TipoEvento } from "./enums";
import type { EventoChave } from "./eventos-chave";
import { podeTransicionar } from "./status";
import {
  type DispensaPendencia,
  lerChavePendencia,
  observacaoResposta,
  type PendenciaStatus,
  pendenciaDispensada,
  pendenciasStatus,
  proximaPendencia,
} from "./sugestao-status";

const HOJE = "2026-11-10";

let proximoId = 1;
const ev = (tipo: TipoEvento, data: string, concluido = false): EventoChave => ({
  id: proximoId++,
  tipo,
  titulo: null,
  data,
  concluido,
});

const primeira = (status: Status, eventos: EventoChave[]) =>
  proximaPendencia(status, eventos, HOJE);
const destinos = (p: PendenciaStatus | null) => p?.respostas.map((r) => [r.id, r.para]);

describe("pendências por evento (#85)", () => {
  it("FIM_INSCRICOES passou → Você se inscreveu? Sim/Não", () => {
    const fim = ev("FIM_INSCRICOES", "2026-11-05");
    for (const s of ["PREVISTO", "EDITAL_PUBLICADO"] as const) {
      const p = primeira(s, [fim]);
      expect(p).toMatchObject({
        chave: `INSCRICAO-${fim.id}`,
        regra: "INSCRICAO",
        eventoId: fim.id,
        dataEvento: "2026-11-05",
        pergunta: "Você se inscreveu?",
        motivo: "Fim das inscrições em 05/11/2026 já passou.",
      });
      expect(destinos(p)).toEqual([
        ["sim", "INSCRITO"],
        ["nao", "NAO_INSCRITO"],
      ]);
    }
    // No último dia ainda dá para se inscrever.
    expect(primeira("PREVISTO", [ev("FIM_INSCRICOES", HOJE)])).toBeNull();
    // Já inscrito: não pergunta.
    expect(primeira("INSCRITO", [fim])).toBeNull();
  });

  it("VENCIMENTO_BOLETO passou → Pagou o boleto?", () => {
    const boleto = ev("VENCIMENTO_BOLETO", "2026-11-08");
    const antes = primeira("EDITAL_PUBLICADO", [ev("FIM_INSCRICOES", "2026-11-01"), boleto]);
    expect(antes).toMatchObject({ regra: "BOLETO", pergunta: "Pagou o boleto?" });
    expect(antes?.respostas).toEqual([
      { id: "sim", rotulo: "Sim", para: "INSCRITO", concluirEvento: true },
      { id: "nao", rotulo: "Não", para: "NAO_INSCRITO", concluirEvento: false },
    ]);
    // Inscrito: "Sim" mantém o status e conclui o boleto; "Não" → Desistiu.
    expect(primeira("INSCRITO", [boleto])?.respostas).toEqual([
      { id: "sim", rotulo: "Sim", para: null, concluirEvento: true },
      { id: "nao", rotulo: "Não (desisti)", para: "DESISTIU", concluirEvento: false },
    ]);
    // Boleto concluído ou ainda no prazo: nada a perguntar.
    expect(primeira("INSCRITO", [ev("VENCIMENTO_BOLETO", "2026-11-08", true)])).toBeNull();
    expect(primeira("INSCRITO", [ev("VENCIMENTO_BOLETO", HOJE)])).toBeNull();
  });

  it("PUBLICACAO_EDITAL chegou (status Previsto) → O edital saiu?", () => {
    const edital = ev("PUBLICACAO_EDITAL", HOJE);
    const p = primeira("PREVISTO", [edital]);
    expect(p).toMatchObject({
      regra: "EDITAL",
      motivo: "Publicação do edital é hoje (10/11/2026).",
    });
    expect(destinos(p)).toEqual([["sim", "EDITAL_PUBLICADO"]]);
    expect(primeira("EDITAL_PUBLICADO", [edital])).toBeNull();
    expect(primeira("PREVISTO", [ev("PUBLICACAO_EDITAL", "2026-11-11")])).toBeNull();
  });

  it("fim das inscrições tem prioridade sobre o edital", () => {
    const eventos = [ev("PUBLICACAO_EDITAL", "2026-10-01"), ev("FIM_INSCRICOES", "2026-11-01")];
    expect(pendenciasStatus("PREVISTO", eventos, HOJE).map((p) => p.regra)).toEqual([
      "INSCRICAO",
      "EDITAL",
    ]);
  });

  it("prova no dia ou depois → Fez a prova? Sim → Prova realizada · Não → Desistiu", () => {
    for (const data of [HOJE, "2026-11-08"]) {
      for (const s of ["INSCRITO", "PROVA_AGENDADA"] as const) {
        const p = primeira(s, [ev("PROVA_OBJETIVA", data)]);
        expect(p?.pergunta).toBe("Fez a prova?");
        expect(destinos(p)).toEqual([
          ["sim", "PROVA_REALIZADA"],
          ["nao", "DESISTIU"],
        ]);
      }
    }
    expect(primeira("PROVA_AGENDADA", [ev("PROVA_DISCURSIVA", "2026-11-08")])?.motivo).toBe(
      "Prova discursiva foi em 08/11/2026.",
    );
    expect(primeira("PROVA_AGENDADA", [ev("PROVA_OBJETIVA", "2026-11-11")])).toBeNull();
  });

  it("prova passada e recurso posterior encerrado: Sim → Aguardando resultado", () => {
    const eventos = [ev("PROVA_OBJETIVA", "2026-10-20"), ev("PRAZO_RECURSO", "2026-10-25")];
    expect(destinos(primeira("PROVA_AGENDADA", eventos))?.[0]).toEqual([
      "sim",
      "AGUARDANDO_RESULTADO",
    ]);
    // Já em Prova realizada: só a mudança para Aguardando resultado.
    expect(primeira("PROVA_REALIZADA", eventos)).toMatchObject({
      regra: "RECURSO",
      motivo: "Prazo de recurso até 25/10/2026 já terminou.",
    });
  });

  it("recurso anterior à prova (ex.: contra a isenção) não conta", () => {
    const eventos = [ev("PRAZO_RECURSO", "2026-09-01"), ev("PROVA_OBJETIVA", "2026-10-20")];
    expect(primeira("PROVA_REALIZADA", eventos)).toBeNull();
  });

  it("inscrito com prova futura → Prova agendada", () => {
    const p = primeira("INSCRITO", [ev("PROVA_DISCURSIVA", "2026-12-06")]);
    expect(p).toMatchObject({
      regra: "PROVA_AGENDADA",
      motivo: "Prova discursiva marcada para 06/12/2026.",
    });
    expect(destinos(p)).toEqual([["sim", "PROVA_AGENDADA"]]);
    expect(primeira("PROVA_AGENDADA", [ev("PROVA_OBJETIVA", "2026-12-06")])).toBeNull();
  });

  it("RESULTADO_FINAL chegou → Qual foi o resultado?", () => {
    const eventos = [ev("PROVA_OBJETIVA", "2026-09-01"), ev("RESULTADO_FINAL", "2026-11-09")];
    for (const s of ["PROVA_REALIZADA", "AGUARDANDO_RESULTADO"] as const) {
      const p = primeira(s, eventos);
      expect(p?.pergunta).toBe("Qual foi o resultado?");
      expect(destinos(p)).toEqual([
        ["aprovado", "APROVADO"],
        ["classificado", "CLASSIFICADO"],
        ["reprovado", "REPROVADO"],
      ]);
    }
    // Ainda não fez a prova (status): primeiro pergunta da prova.
    expect(primeira("PROVA_AGENDADA", eventos)?.regra).toBe("PROVA");
  });

  it("CONVOCACAO/NOMEACAO/POSSE chegou → Foi nomeado? / Tomou posse?", () => {
    for (const tipo of ["CONVOCACAO", "NOMEACAO", "POSSE"] as const) {
      for (const s of ["APROVADO", "CLASSIFICADO"] as const) {
        const p = primeira(s, [ev(tipo, "2026-11-01")]);
        expect(p?.pergunta).toBe("Foi nomeado?");
        expect(destinos(p)).toEqual([["sim", "NOMEADO"]]);
      }
    }
    const posse = primeira("NOMEADO", [ev("NOMEACAO", "2026-10-01"), ev("POSSE", HOJE)]);
    expect(posse?.pergunta).toBe("Tomou posse?");
    expect(destinos(posse)).toEqual([
      ["sim", "EMPOSSADO"],
      ["nao", "DESISTIU"],
    ]);
    expect(primeira("NOMEADO", [ev("NOMEACAO", "2026-10-01")])).toBeNull();
  });

  it("nada para concursos encerrados, cancelados ou suspensos", () => {
    const eventos = [
      ev("PUBLICACAO_EDITAL", "2026-09-01"),
      ev("FIM_INSCRICOES", "2026-09-10"),
      ev("PROVA_OBJETIVA", "2026-10-01"),
      ev("RESULTADO_FINAL", "2026-11-01"),
      ev("POSSE", "2026-11-05"),
    ];
    for (const s of [
      "CANCELADO",
      "DESISTIU",
      "NAO_INSCRITO",
      "EMPOSSADO",
      "REPROVADO",
      "SUSPENSO",
    ] as const) {
      expect(pendenciasStatus(s, eventos, HOJE)).toEqual([]);
    }
  });

  it("toda resposta é uma transição permitida ou mantém o status", () => {
    const eventos = [
      ev("PUBLICACAO_EDITAL", "2026-09-01"),
      ev("FIM_INSCRICOES", "2026-09-10"),
      ev("VENCIMENTO_BOLETO", "2026-09-12"),
      ev("PROVA_OBJETIVA", "2026-10-01"),
      ev("PRAZO_RECURSO", "2026-10-05"),
      ev("PROVA_DISCURSIVA", "2026-12-01"),
      ev("RESULTADO_FINAL", "2026-11-01"),
      ev("NOMEACAO", "2026-11-05"),
      ev("POSSE", "2026-11-08"),
    ];
    for (const s of STATUS) {
      for (const p of pendenciasStatus(s, eventos, HOJE)) {
        expect(p.respostas.length).toBeGreaterThan(0);
        for (const r of p.respostas) {
          if (r.para) expect(podeTransicionar(s, r.para)).toBe(true);
        }
      }
    }
  });

  it("ignora datas inválidas e rejeita hoje inválido", () => {
    expect(primeira("INSCRITO", [ev("PROVA_OBJETIVA", "invalida")])).toBeNull();
    expect(() => pendenciasStatus("INSCRITO", [], "x")).toThrow(RangeError);
  });
});

describe("dispensar / lembrar depois", () => {
  const fim = ev("FIM_INSCRICOES", "2026-11-01");
  const edital = ev("PUBLICACAO_EDITAL", "2026-10-01");
  const dispensa = (ate: string | null, dataEvento = fim.data): DispensaPendencia => ({
    regra: "INSCRICAO",
    eventoId: fim.id,
    dataEvento,
    ate,
  });

  it("dispensada: passa para a próxima pendência", () => {
    expect(proximaPendencia("PREVISTO", [fim, edital], HOJE, [dispensa(null)])?.regra).toBe(
      "EDITAL",
    );
  });

  it("adiada: volta a aparecer na data marcada", () => {
    const d = dispensa("2026-11-12");
    expect(
      pendenciaDispensada(
        { regra: "INSCRICAO", eventoId: fim.id, dataEvento: fim.data },
        [d],
        HOJE,
      ),
    ).toBe(true);
    expect(proximaPendencia("PREVISTO", [fim], "2026-11-11", [d])).toBeNull();
    expect(proximaPendencia("PREVISTO", [fim], "2026-11-12", [d])?.regra).toBe("INSCRICAO");
  });

  it("se a data do evento mudou, a dispensa não vale mais", () => {
    expect(proximaPendencia("PREVISTO", [fim], HOJE, [dispensa(null, "2026-10-20")])?.regra).toBe(
      "INSCRICAO",
    );
  });
});

describe("lerChavePendencia / observacaoResposta", () => {
  it("interpreta chaves válidas", () => {
    expect(lerChavePendencia("PROVA-12")).toEqual({ regra: "PROVA", eventoId: 12 });
    expect(lerChavePendencia("PROVA_AGENDADA-3")).toEqual({ regra: "PROVA_AGENDADA", eventoId: 3 });
    for (const c of ["X-1", "PROVA-0", "PROVA-", "prova-1", 12, null]) {
      expect(lerChavePendencia(c)).toBeNull();
    }
  });

  it("monta a observação do histórico", () => {
    const p = primeira("PROVA_AGENDADA", [ev("PROVA_OBJETIVA", "2026-11-08")]);
    const r = p?.respostas[0];
    if (!p || !r) throw new Error("sem pendência");
    expect(observacaoResposta(p, r)).toBe(
      "Pendência: Fez a prova? Sim. Prova objetiva foi em 08/11/2026.",
    );
  });
});
