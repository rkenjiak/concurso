import { describe, expect, it } from "vitest";
import { acaoDaTecla, deveBloquear, type EstadoTecla, filtrarSugestoes, tagsDoTexto } from "./tags";

const estado = (parcial: Partial<EstadoTecla>): EstadoTecla => ({
  key: "Enter",
  compondo: false,
  texto: "",
  quantidade: 0,
  sugestoes: [],
  destaque: -1,
  ...parcial,
});

describe("acaoDaTecla", () => {
  it("Enter adiciona o texto digitado mesmo com sugestões visíveis", () => {
    const e = estado({ texto: "tribunais", sugestoes: ["tribunais federais"] });
    const acao = acaoDaTecla(e);
    expect(acao).toEqual({ tipo: "adicionar", valor: "tribunais" });
    expect(deveBloquear(e, acao)).toBe(true);
  });

  it("Enter com sugestão destacada adiciona a sugestão", () => {
    expect(acaoDaTecla(estado({ texto: "tri", sugestoes: ["tribunais"], destaque: 0 }))).toEqual({
      tipo: "adicionar",
      valor: "tribunais",
    });
  });

  it("Enter com campo vazio não adiciona, mas não envia o formulário", () => {
    const e = estado({ texto: "  " });
    const acao = acaoDaTecla(e);
    expect(acao).toEqual({ tipo: "nenhuma" });
    expect(deveBloquear(e, acao)).toBe(true);
  });

  it("ignora teclas durante composição de IME", () => {
    const e = estado({ texto: "fiscal", compondo: true });
    const acao = acaoDaTecla(e);
    expect(acao).toEqual({ tipo: "nenhuma" });
    expect(deveBloquear(e, acao)).toBe(false);
  });

  it("vírgula e Tab adicionam apenas com texto", () => {
    expect(acaoDaTecla(estado({ key: ",", texto: "a" }))).toEqual({
      tipo: "adicionar",
      valor: "a",
    });
    expect(acaoDaTecla(estado({ key: "," }))).toEqual({ tipo: "nenhuma" });
    expect(acaoDaTecla(estado({ key: "Tab", texto: "b" }))).toEqual({
      tipo: "adicionar",
      valor: "b",
    });
    expect(acaoDaTecla(estado({ key: "Tab", sugestoes: ["x"], destaque: 0 }))).toEqual({
      tipo: "adicionar",
      valor: "x",
    });
    const tabVazio = estado({ key: "Tab" });
    expect(deveBloquear(tabVazio, acaoDaTecla(tabVazio))).toBe(false);
  });

  it("Backspace no campo vazio remove a última tag", () => {
    expect(acaoDaTecla(estado({ key: "Backspace", quantidade: 2 }))).toEqual({
      tipo: "remover-ultima",
    });
    expect(acaoDaTecla(estado({ key: "Backspace", quantidade: 0 }))).toEqual({ tipo: "nenhuma" });
    expect(acaoDaTecla(estado({ key: "Backspace", texto: "a", quantidade: 2 }))).toEqual({
      tipo: "nenhuma",
    });
  });

  it("setas navegam pelas sugestões em ciclo", () => {
    const sugestoes = ["a", "b", "c"];
    expect(acaoDaTecla(estado({ key: "ArrowDown", sugestoes }))).toEqual({
      tipo: "destacar",
      indice: 0,
    });
    expect(acaoDaTecla(estado({ key: "ArrowDown", sugestoes, destaque: 2 }))).toEqual({
      tipo: "destacar",
      indice: 0,
    });
    expect(acaoDaTecla(estado({ key: "ArrowUp", sugestoes }))).toEqual({
      tipo: "destacar",
      indice: 2,
    });
    expect(acaoDaTecla(estado({ key: "ArrowUp", sugestoes, destaque: 2 }))).toEqual({
      tipo: "destacar",
      indice: 1,
    });
    expect(acaoDaTecla(estado({ key: "ArrowDown" }))).toEqual({ tipo: "nenhuma" });
    expect(acaoDaTecla(estado({ key: "ArrowUp" }))).toEqual({ tipo: "nenhuma" });
  });

  it("Escape fecha a lista aberta", () => {
    expect(acaoDaTecla(estado({ key: "Escape", sugestoes: ["a"] }))).toEqual({ tipo: "fechar" });
    expect(acaoDaTecla(estado({ key: "Escape" }))).toEqual({ tipo: "nenhuma" });
  });

  it("outras teclas não fazem nada", () => {
    const e = estado({ key: "a", texto: "x" });
    expect(acaoDaTecla(e)).toEqual({ tipo: "nenhuma" });
    expect(deveBloquear(e, acaoDaTecla(e))).toBe(false);
  });
});

describe("filtrarSugestoes", () => {
  const todas = ["tribunais", "prioridade", "área fiscal", "federal"];

  it("filtra por trecho sem acento e ignora as já adicionadas", () => {
    expect(filtrarSugestoes(todas, ["federal"], "AREA")).toEqual(["área fiscal"]);
    expect(filtrarSugestoes(todas, [], "al")).toEqual(["área fiscal", "federal"]);
  });

  it("texto vazio lista as disponíveis respeitando o limite", () => {
    expect(filtrarSugestoes(todas, ["tribunais"], "", 2)).toEqual(["prioridade", "área fiscal"]);
  });
});

describe("tagsDoTexto", () => {
  it("separa por vírgula, normaliza e remove repetidas e já adicionadas", () => {
    expect(tagsDoTexto(" Tribunais , FISCAL,, tribunais, prioridade", ["prioridade"])).toEqual([
      "tribunais",
      "fiscal",
    ]);
  });
});
