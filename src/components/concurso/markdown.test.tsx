import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const html = (md: string) => renderToStaticMarkup(<Markdown>{md}</Markdown>);

describe("Markdown", () => {
  it("renderiza tabelas GFM como <table> dentro de wrapper com rolagem horizontal", () => {
    const saida = html("| Cargo | Vagas |\n| --- | --- |\n| Analista | 10 |");
    expect(saida).toContain('<div class="overflow-x-auto');
    expect(saida).toContain("<table");
    expect(saida).toMatch(/<thead class="bg-muted">/);
    expect(saida).toMatch(/<th[^>]*>Cargo<\/th>/);
    expect(saida).toMatch(/<td[^>]*>Analista<\/td>/);
    expect(saida).not.toContain("| Cargo |");
  });

  it("usa apenas tokens do tema (sem cores fixas) na tabela", () => {
    const saida = html("| a |\n| - |\n| b |");
    expect(saida).not.toMatch(/(bg|border|text)-(gray|slate|zinc|neutral|white|black)/);
  });

  it("suporta tachado do GFM", () => {
    expect(html("~~antigo~~")).toContain("<del>antigo</del>");
  });

  it("continua descartando HTML bruto, inclusive dentro de tabelas", () => {
    const saida = html(
      '<script>alert(1)</script>\n\n| a |\n| - |\n| <img src=x onerror="alert(1)"> |',
    );
    expect(saida).not.toContain("<script");
    expect(saida).not.toContain("<img");
    expect(saida).not.toContain("onerror");
  });

  it("neutraliza URLs perigosas e abre links em nova aba", () => {
    const saida = html("[x](javascript:alert(1)) https://exemplo.com");
    expect(saida).not.toContain("javascript:");
    expect(saida).toContain('href="https://exemplo.com"');
    expect(saida).toContain('rel="noopener noreferrer"');
  });
});
