import { describe, expect, it } from "vitest";
import { feedbackSchema, hrefFeedback, idsFeedbackSchema, lerFiltrosFeedback } from "./feedback";

describe("lerFiltrosFeedback / hrefFeedback", () => {
  it("padrão: novos, sem tipo nem busca, página 1", () => {
    expect(lerFiltrosFeedback({})).toEqual({ status: "NOVO", tipo: null, busca: "", pagina: 1 });
    expect(hrefFeedback(lerFiltrosFeedback({}))).toBe("/admin/feedback");
  });

  it("lê e escreve os filtros; inválidos voltam ao padrão", () => {
    const f = lerFiltrosFeedback({ status: "descartado", tipo: "bug", busca: " x ", pagina: "3" });
    expect(f).toEqual({ status: "DESCARTADO", tipo: "BUG", busca: "x", pagina: 3 });
    expect(hrefFeedback(f)).toBe("/admin/feedback?status=descartado&tipo=bug&busca=x&pagina=3");
    expect(lerFiltrosFeedback({ status: "x", tipo: "y", pagina: "-2" })).toEqual(
      lerFiltrosFeedback({}),
    );
  });
});

describe("schemas", () => {
  it("ids: sem repetição, de 1 a 200", () => {
    expect(idsFeedbackSchema.parse([3, 3, 1])).toEqual([3, 1]);
    expect(idsFeedbackSchema.safeParse([]).success).toBe(false);
    expect(idsFeedbackSchema.safeParse([0]).success).toBe(false);
    expect(idsFeedbackSchema.safeParse(Array.from({ length: 201 }, (_, i) => i + 1)).success).toBe(
      false,
    );
  });

  it("feedback: mensagem aparada e página normalizada", () => {
    expect(
      feedbackSchema.parse({ tipo: "BUG", mensagem: "  dez letras ok ", pagina: "/concursos/1?a" }),
    ).toEqual({ tipo: "BUG", mensagem: "dez letras ok", pagina: "/concursos/[id]" });
  });
});
