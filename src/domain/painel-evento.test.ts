import { describe, expect, it } from "vitest";
import { itensCalendario, proximosDoConcurso } from "./calendario";
import type { CorConcurso } from "./cores";
import type { Status, TipoEvento } from "./enums";
import { apareceNoDashboard, paraPainel } from "./painel-evento";
import { proximosPrazos } from "./prazos";

const HOJE = "2026-11-10";
const COR: CorConcurso = "AZUL";

const concurso = (id: number, status: Status = "INSCRITO", extra = {}) => ({
  id,
  orgao: `Órgão ${id}`,
  cargo: "Analista",
  status,
  cor: COR,
  icone: null,
  validadeFim: null as string | null,
  validadeOcultaDashboard: false,
  ...extra,
});

let proximoId = 1;
const evento = (
  concursoId: number,
  data: string,
  tipo: TipoEvento = "VENCIMENTO_BOLETO",
  extra: Partial<{ concluido: boolean; ocultoDashboard: boolean; titulo: string }> = {},
) => ({
  id: proximoId++,
  concursoId,
  tipo,
  titulo: extra.titulo ?? null,
  data,
  hora: null,
  local: "Sala 1",
  observacao: "Levar documento",
  concluido: extra.concluido ?? false,
  ocultoDashboard: extra.ocultoDashboard ?? false,
});

describe("apareceNoDashboard", () => {
  it("pendente, de concurso acompanhado e, se passou, de tipo crítico", () => {
    const base = { concluido: false, dias: 3, critico: false, status: "INSCRITO" as Status };
    expect(apareceNoDashboard(base)).toBe(true);
    expect(apareceNoDashboard({ ...base, concluido: true })).toBe(false);
    expect(apareceNoDashboard({ ...base, status: "CANCELADO" })).toBe(false);
    expect(apareceNoDashboard({ ...base, dias: -1 })).toBe(false);
    expect(apareceNoDashboard({ ...base, dias: -1, critico: true })).toBe(true);
  });
});

describe("paraPainel", () => {
  it("prazo do dashboard: evento editável, situação, oculto e próximos do concurso", () => {
    const e1 = evento(1, "2026-11-12", "VENCIMENTO_BOLETO", { titulo: "Boleto" });
    const e2 = evento(1, "2026-11-20", "PROVA_OBJETIVA");
    const e3 = evento(2, "2026-11-15", "PROVA_OBJETIVA");
    const grupos = proximosPrazos([e1, e2, e3], [concurso(1), concurso(2)], HOJE);
    const lista = [...grupos.vencidos, ...grupos.hoje, ...grupos.proximos];
    const prazo = lista.find((p) => p.chave === `evento-${e1.id}`);
    if (!prazo) throw new Error("prazo ausente");

    const dados = paraPainel(prazo, proximosDoConcurso(lista, prazo, HOJE));
    expect(dados).toEqual({
      chave: `evento-${e1.id}`,
      nome: "Boleto",
      derivado: false,
      evento: {
        id: e1.id,
        tipo: "VENCIMENTO_BOLETO",
        titulo: "Boleto",
        data: "2026-11-12",
        hora: null,
        local: "Sala 1",
        observacao: "Levar documento",
        concluido: false,
      },
      data: "2026-11-12",
      hora: null,
      local: "Sala 1",
      concluido: false,
      situacao: "URGENTE",
      oculto: false,
      concurso: {
        id: 1,
        orgao: "Órgão 1",
        cargo: "Analista",
        status: "INSCRITO",
        cor: COR,
        icone: null,
      },
      proximos: [
        { chave: `evento-${e2.id}`, nome: "Prova objetiva", data: "2026-11-20", hora: null },
      ],
    });
    // Só dados serializáveis (o painel é um componente cliente).
    expect(JSON.parse(JSON.stringify(dados))).toEqual(dados);
  });

  it("item do calendário: oculto só se aparece no dashboard; concluído não oferece ocultar", () => {
    const pendente = evento(1, "2026-11-12", "VENCIMENTO_BOLETO", { ocultoDashboard: true });
    const concluido = evento(1, "2026-11-13", "VENCIMENTO_BOLETO", { concluido: true });
    const encerrado = evento(2, "2026-11-14");
    const itens = itensCalendario(
      [pendente, concluido, encerrado],
      [concurso(1), concurso(2, "CANCELADO")],
      "2026-11-01",
      "2026-11-30",
      HOJE,
    );
    const porChave = (id: number) => {
      const item = itens.find((i) => i.chave === `evento-${id}`);
      if (!item) throw new Error("item ausente");
      return paraPainel(item, []);
    };
    expect(porChave(pendente.id).oculto).toBe(true);
    expect(porChave(concluido.id)).toMatchObject({ oculto: null, concluido: true });
    // A situação ignora a conclusão (a UI mostra "Concluído" e volta a esta ao reabrir).
    expect(porChave(concluido.id).situacao).toBe("URGENTE");
    expect(porChave(encerrado.id)).toMatchObject({ oculto: null, situacao: null });
  });

  it("validade derivada: sem evento, nome próprio e ocultar pela preferência do concurso", () => {
    const c = concurso(3, "APROVADO", {
      validadeFim: "2026-11-20",
      validadeOcultaDashboard: true,
    });
    const [item] = itensCalendario([], [c], "2026-11-01", "2026-11-30", HOJE);
    if (!item) throw new Error("item ausente");
    expect(paraPainel(item, [])).toMatchObject({
      chave: "validade-3",
      nome: "Fim da validade do concurso",
      derivado: true,
      evento: null,
      local: null,
      concluido: false,
      oculto: true,
    });
  });
});
