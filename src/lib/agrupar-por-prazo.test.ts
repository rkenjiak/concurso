import { describe, expect, it } from "vitest";
import {
  type ConcursoNotificavel,
  notificacoesDisparadas,
  REGRAS_PADRAO,
} from "@/domain/notificacoes";
import type { EventoPrazo } from "@/domain/prazos";
import { agruparPorPrazo, grupoDoPrazo } from "./agrupar-por-prazo";

describe("grupoDoPrazo", () => {
  it("separa hoje e amanhã (0–1), próximos 7 dias (2–7) e mais adiante (8+)", () => {
    expect(grupoDoPrazo(0)).toBe("hoje-amanha");
    expect(grupoDoPrazo(1)).toBe("hoje-amanha");
    expect(grupoDoPrazo(2)).toBe("proximos-7");
    expect(grupoDoPrazo(7)).toBe("proximos-7");
    expect(grupoDoPrazo(8)).toBe("mais-adiante");
    expect(grupoDoPrazo(90)).toBe("mais-adiante");
  });

  it("trata prazo vencido como hoje e amanhã", () => {
    expect(grupoDoPrazo(-1)).toBe("hoje-amanha");
  });
});

describe("agruparPorPrazo", () => {
  const item = (id: string, dias: number, data: string, hora: string | null = null) => ({
    id,
    dias,
    data,
    hora,
  });

  it("agrupa na ordem dos grupos e ordena pelo prazo mais próximo (data, depois hora)", () => {
    const itens = [
      item("a", 7, "2026-03-08"),
      item("b", 1, "2026-03-02", "14:00"),
      item("c", 8, "2026-03-09"),
      item("d", 0, "2026-03-01"),
      item("e", 2, "2026-03-03"),
      item("f", 1, "2026-03-02", "09:00"),
      item("g", 1, "2026-03-02"),
    ];
    const grupos = agruparPorPrazo(itens);
    expect(grupos.map((g) => g.rotulo)).toEqual([
      "Hoje e amanhã",
      "Próximos 7 dias",
      "Mais adiante",
    ]);
    expect(grupos.map((g) => g.itens.map((i) => i.id))).toEqual([
      ["d", "g", "f", "b"],
      ["e", "a"],
      ["c"],
    ]);
  });

  it("omite grupos vazios", () => {
    const so = item("a", 30, "2026-03-31");
    expect(agruparPorPrazo([so])).toEqual([
      { chave: "mais-adiante", rotulo: "Mais adiante", itens: [so] },
    ]);
    expect(agruparPorPrazo([])).toEqual([]);
  });

  describe("com notificações do domínio (agrupa pelo prazo, não pelo disparo)", () => {
    const HOJE = "2026-03-10";
    const concurso: ConcursoNotificavel = { id: 1, status: "INSCRITO" };
    const evento = (id: number, tipo: EventoPrazo["tipo"], data: string): EventoPrazo => ({
      id,
      concursoId: 1,
      tipo,
      titulo: null,
      data,
      hora: null,
      concluido: false,
    });

    it("prova hoje com a regra padrão [7, 1] fica em Hoje e amanhã (disparada ontem)", () => {
      expect(REGRAS_PADRAO.PROVA_OBJETIVA.antecedencias).toEqual([7, 1]);
      const ns = notificacoesDisparadas(
        [evento(1, "PROVA_OBJETIVA", HOJE)],
        [concurso],
        REGRAS_PADRAO,
        HOJE,
      );
      expect(ns).toHaveLength(1);
      expect(ns[0]).toMatchObject({ mensagem: "Prova objetiva é hoje", disparadaEm: "2026-03-09" });
      expect(agruparPorPrazo(ns).map((g) => g.rotulo)).toEqual(["Hoje e amanhã"]);
    });

    it("prazo em 3 dias com antecedência vigente 7 fica em Próximos 7 dias", () => {
      const ns = notificacoesDisparadas(
        [evento(2, "FIM_INSCRICOES", "2026-03-13")],
        [concurso],
        REGRAS_PADRAO,
        HOJE,
      );
      expect(ns).toHaveLength(1);
      expect(ns[0]).toMatchObject({ dias: 3, antecedencia: 7, disparadaEm: "2026-03-06" });
      expect(agruparPorPrazo(ns).map((g) => g.rotulo)).toEqual(["Próximos 7 dias"]);
    });
  });
});
