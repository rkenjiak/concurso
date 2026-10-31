import { describe, expect, it } from "vitest";
import { STATUS, type Status } from "./enums";
import { ErroDominio } from "./erros";
import {
  contextoDoHistorico,
  ehAtivo,
  ehTerminal,
  exigirTransicao,
  podeDesfazer,
  podeTransicionar,
  posicaoNaTrilha,
  STATUS_TERMINAIS,
  statusAntesDaSuspensao,
  statusAoDesfazer,
  TRILHA_PRINCIPAL,
  transicoesPermitidas,
} from "./status";

describe("ehTerminal / ehAtivo", () => {
  it.each(["EMPOSSADO", "DESISTIU", "NAO_INSCRITO", "CANCELADO", "REPROVADO"] as Status[])(
    "%s é terminal",
    (s) => {
      expect(ehTerminal(s)).toBe(true);
      expect(ehAtivo(s)).toBe(false);
    },
  );

  it("demais status são ativos (inclusive SUSPENSO)", () => {
    const ativos = STATUS.filter((s) => !(STATUS_TERMINAIS as readonly Status[]).includes(s));
    expect(ativos).toContain("SUSPENSO");
    for (const s of ativos) {
      expect(ehAtivo(s)).toBe(true);
      expect(ehTerminal(s)).toBe(false);
    }
  });
});

describe("posicaoNaTrilha", () => {
  it("retorna o índice na trilha principal", () => {
    expect(posicaoNaTrilha("PREVISTO")).toBe(0);
    expect(posicaoNaTrilha("AGUARDANDO_RESULTADO")).toBe(5);
  });

  it("retorna -1 fora da trilha", () => {
    expect(posicaoNaTrilha("APROVADO")).toBe(-1);
    expect(posicaoNaTrilha("SUSPENSO")).toBe(-1);
  });
});

describe("transicoesPermitidas", () => {
  it("trilha principal avança para qualquer etapa posterior (pode pular)", () => {
    TRILHA_PRINCIPAL.forEach((de, i) => {
      const destinos = transicoesPermitidas(de);
      for (const posterior of TRILHA_PRINCIPAL.slice(i + 1)) expect(destinos).toContain(posterior);
      for (const anterior of TRILHA_PRINCIPAL.slice(0, i + 1)) {
        expect(destinos).not.toContain(anterior);
      }
    });
  });

  it("PREVISTO", () => {
    expect(transicoesPermitidas("PREVISTO")).toEqual([
      "EDITAL_PUBLICADO",
      "INSCRITO",
      "PROVA_AGENDADA",
      "PROVA_REALIZADA",
      "AGUARDANDO_RESULTADO",
      "NAO_INSCRITO",
      "SUSPENSO",
      "CANCELADO",
    ]);
  });

  it("EDITAL_PUBLICADO pode ir para NAO_INSCRITO, mas não DESISTIU", () => {
    const d = transicoesPermitidas("EDITAL_PUBLICADO");
    expect(d).toContain("NAO_INSCRITO");
    expect(d).not.toContain("DESISTIU");
    expect(d).not.toContain("APROVADO");
  });

  it.each(["INSCRITO", "PROVA_AGENDADA", "PROVA_REALIZADA", "AGUARDANDO_RESULTADO"] as Status[])(
    "%s pode DESISTIR e não pode NAO_INSCRITO",
    (de) => {
      const d = transicoesPermitidas(de);
      expect(d).toContain("DESISTIU");
      expect(d).not.toContain("NAO_INSCRITO");
    },
  );

  it("INSCRITO e PROVA_AGENDADA não vão direto para resultado", () => {
    for (const de of ["INSCRITO", "PROVA_AGENDADA"] as Status[]) {
      const d = transicoesPermitidas(de);
      expect(d).not.toContain("APROVADO");
      expect(d).not.toContain("REPROVADO");
    }
  });

  it("PROVA_REALIZADA e AGUARDANDO_RESULTADO vão para resultados", () => {
    for (const de of ["PROVA_REALIZADA", "AGUARDANDO_RESULTADO"] as Status[]) {
      expect(transicoesPermitidas(de)).toEqual(
        expect.arrayContaining(["APROVADO", "CLASSIFICADO", "REPROVADO"]),
      );
    }
  });

  it("AGUARDANDO_RESULTADO", () => {
    expect(transicoesPermitidas("AGUARDANDO_RESULTADO")).toEqual([
      "APROVADO",
      "CLASSIFICADO",
      "REPROVADO",
      "DESISTIU",
      "SUSPENSO",
      "CANCELADO",
    ]);
  });

  it("APROVADO", () => {
    expect(transicoesPermitidas("APROVADO")).toEqual([
      "CLASSIFICADO",
      "REPROVADO",
      "NOMEADO",
      "DESISTIU",
      "SUSPENSO",
      "CANCELADO",
    ]);
  });

  it("CLASSIFICADO", () => {
    expect(transicoesPermitidas("CLASSIFICADO")).toEqual([
      "APROVADO",
      "REPROVADO",
      "NOMEADO",
      "DESISTIU",
      "SUSPENSO",
      "CANCELADO",
    ]);
  });

  it("REPROVADO só pode ser revisto para APROVADO/CLASSIFICADO", () => {
    expect(transicoesPermitidas("REPROVADO")).toEqual(["APROVADO", "CLASSIFICADO"]);
  });

  it("NOMEADO", () => {
    expect(transicoesPermitidas("NOMEADO")).toEqual([
      "EMPOSSADO",
      "DESISTIU",
      "SUSPENSO",
      "CANCELADO",
    ]);
  });

  it.each(["EMPOSSADO", "DESISTIU", "NAO_INSCRITO", "CANCELADO"] as Status[])(
    "%s não tem saída",
    (de) => {
      expect(transicoesPermitidas(de)).toEqual([]);
    },
  );

  it("SUSPENSO retoma o status anterior à suspensão ou cancela", () => {
    expect(transicoesPermitidas("SUSPENSO", { statusAntesSuspensao: "INSCRITO" })).toEqual([
      "INSCRITO",
      "CANCELADO",
    ]);
  });

  it("SUSPENSO sem status anterior conhecido só pode ser cancelado", () => {
    expect(transicoesPermitidas("SUSPENSO")).toEqual(["CANCELADO"]);
    expect(transicoesPermitidas("SUSPENSO", { statusAntesSuspensao: null })).toEqual(["CANCELADO"]);
    expect(transicoesPermitidas("SUSPENSO", { statusAntesSuspensao: "SUSPENSO" })).toEqual([
      "CANCELADO",
    ]);
  });

  it("todo status não terminal pode ser suspenso ou cancelado (exceto SUSPENSO→SUSPENSO)", () => {
    for (const de of STATUS.filter(ehAtivo)) {
      const d = transicoesPermitidas(de);
      expect(d).toContain("CANCELADO");
      if (de !== "SUSPENSO") expect(d).toContain("SUSPENSO");
    }
  });

  it("nunca permite transição para o próprio status", () => {
    for (const de of STATUS) {
      expect(transicoesPermitidas(de, { statusAntesSuspensao: de })).not.toContain(de);
    }
  });

  it("contexto de suspensão é ignorado fora de SUSPENSO", () => {
    const d = transicoesPermitidas("AGUARDANDO_RESULTADO", { statusAntesSuspensao: "PREVISTO" });
    expect(d).not.toContain("PREVISTO");
  });
});

describe("podeTransicionar / exigirTransicao", () => {
  it("permite pular etapas na trilha", () => {
    expect(podeTransicionar("PREVISTO", "PROVA_REALIZADA")).toBe(true);
  });

  it("não permite voltar na trilha", () => {
    expect(podeTransicionar("PROVA_AGENDADA", "INSCRITO")).toBe(false);
  });

  it("não permite sair de terminal", () => {
    expect(podeTransicionar("EMPOSSADO", "NOMEADO")).toBe(false);
    expect(podeTransicionar("CANCELADO", "PREVISTO")).toBe(false);
  });

  it("considera o contexto de suspensão", () => {
    const ctx = { statusAntesSuspensao: "INSCRITO" as const };
    expect(podeTransicionar("SUSPENSO", "INSCRITO", ctx)).toBe(true);
    expect(podeTransicionar("SUSPENSO", "PREVISTO", ctx)).toBe(false);
  });

  it("exigirTransicao lança ErroDominio com mensagem em pt-BR", () => {
    expect(() => exigirTransicao("PREVISTO", "INSCRITO")).not.toThrow();
    expect(() => exigirTransicao("EMPOSSADO", "PREVISTO")).toThrow(ErroDominio);
    expect(() => exigirTransicao("EMPOSSADO", "PREVISTO")).toThrow(
      `Não é possível mudar o status de "Empossado" para "Previsto".`,
    );
  });
});

describe("histórico", () => {
  it("statusAntesDaSuspensao usa a suspensão mais recente", () => {
    expect(
      statusAntesDaSuspensao([
        { de: null, para: "PREVISTO" },
        { de: "PREVISTO", para: "SUSPENSO" },
        { de: "SUSPENSO", para: "PREVISTO" },
        { de: "PREVISTO", para: "INSCRITO" },
        { de: "INSCRITO", para: "SUSPENSO" },
      ]),
    ).toBe("INSCRITO");
  });

  it("statusAntesDaSuspensao retorna null sem suspensão ou se criado suspenso", () => {
    expect(statusAntesDaSuspensao([])).toBeNull();
    expect(statusAntesDaSuspensao([{ de: null, para: "PREVISTO" }])).toBeNull();
    expect(statusAntesDaSuspensao([{ de: null, para: "SUSPENSO" }])).toBeNull();
  });

  it("contextoDoHistorico monta o contexto de transição", () => {
    const ctx = contextoDoHistorico([
      { de: null, para: "EDITAL_PUBLICADO" },
      { de: "EDITAL_PUBLICADO", para: "SUSPENSO" },
    ]);
    expect(ctx).toEqual({ statusAntesSuspensao: "EDITAL_PUBLICADO" });
    expect(transicoesPermitidas("SUSPENSO", ctx)).toEqual(["EDITAL_PUBLICADO", "CANCELADO"]);
  });
});

describe("desfazer", () => {
  it("pode desfazer qualquer mudança que não seja a criação", () => {
    expect(podeDesfazer({ de: "PREVISTO", para: "INSCRITO" })).toBe(true);
    // inclusive saindo de terminal (correção de erro de digitação)
    expect(podeDesfazer({ de: "NOMEADO", para: "EMPOSSADO" })).toBe(true);
  });

  it("não pode desfazer a criação nem histórico vazio", () => {
    expect(podeDesfazer({ de: null, para: "PREVISTO" })).toBe(false);
    expect(podeDesfazer(null)).toBe(false);
    expect(podeDesfazer(undefined)).toBe(false);
  });

  it("statusAoDesfazer restaura o `de`", () => {
    expect(statusAoDesfazer({ de: "INSCRITO", para: "CANCELADO" })).toBe("INSCRITO");
  });

  it("statusAoDesfazer lança quando não há o que desfazer", () => {
    expect(() => statusAoDesfazer({ de: null, para: "PREVISTO" })).toThrow(ErroDominio);
    expect(() => statusAoDesfazer(undefined)).toThrow("Não há mudança de status para desfazer.");
  });
});
