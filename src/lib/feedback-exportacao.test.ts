import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  aspasShell,
  comandoGh,
  comandosGh,
  corpoFeedback,
  delimitadorHeredoc,
  type FeedbackExportavel,
  jsonFeedbacks,
  markdownAgrupado,
  markdownIssues,
  tituloFeedback,
} from "./feedback-exportacao";

const base: FeedbackExportavel = {
  id: 123,
  tipo: "BUG",
  mensagem: "O botão de salvar não responde no celular.",
  pagina: "/concursos/[id]",
  versaoApp: "2.7.0",
  commitApp: "a1b2c3d",
  userAgent: "Mozilla/5.0 (Android)",
  usuario: "ana@exemplo.com",
  status: "NOVO",
  // 14:32 em Brasília.
  createdAt: new Date("2026-11-09T17:32:00Z"),
};

const MALICIOSA = [
  // biome-ignore lint/suspicious/noTemplateCurlyInString: é o texto que o shell não pode expandir
  "Teste $(rm -rf ~) e `whoami` e ${HOME} e 'aspas' e \"duplas\"",
  "FEEDBACK_123",
  "EOF",
  "fim\\",
].join("\n");

describe("tituloFeedback", () => {
  it("tipo entre colchetes e os primeiros 60 caracteres", () => {
    expect(tituloFeedback(base)).toBe("[Bug] O botão de salvar não responde no celular.");
    const longa = { ...base, tipo: "SUGESTAO" as const, mensagem: `${"a".repeat(70)}\nfim` };
    expect(tituloFeedback(longa)).toBe(`[Sugestão] ${"a".repeat(60)}…`);
  });

  it("uma linha só, sem caracteres de controle", () => {
    expect(tituloFeedback({ ...base, mensagem: "linha 1\r\nlinha\u0007 2\tok" })).toBe(
      "[Bug] linha 1 linha 2 ok",
    );
  });
});

describe("corpoFeedback", () => {
  it("segue o modelo da issue, sem e-mail por padrão", () => {
    expect(corpoFeedback(base)).toBe(
      [
        "## Feedback de usuário",
        "> O botão de salvar não responde no celular.",
        "",
        "- **Tipo:** Bug",
        "- **Página:** `/concursos/[id]`",
        "- **Versão:** 2.7.0 (a1b2c3d) · **Navegador:** Mozilla/5.0 (Android)",
        "- **Recebido em:** 09/11/2026 14:32",
        "- **Ref.:** feedback #123",
      ].join("\n"),
    );
  });

  it("com incluirEmail, traz o usuário", () => {
    expect(corpoFeedback(base, { incluirEmail: true })).toContain("- **Usuário:** ana@exemplo.com");
  });

  it("cita todas as linhas da mensagem, inclusive as vazias", () => {
    const corpo = corpoFeedback({ ...base, mensagem: "um\n\n## não é título\r\ndois" });
    expect(corpo).toContain("> um\n>\n> ## não é título\n> dois");
  });
});

describe("formatos", () => {
  const outro: FeedbackExportavel = {
    ...base,
    id: 124,
    tipo: "OUTRO",
    mensagem: "Gostei do calendário.",
    pagina: null,
    userAgent: null,
  };

  it("Markdown: uma issue por feedback, em blocos separados", () => {
    const md = markdownIssues([base, outro]);
    expect(md.split("\n\n---\n\n")).toHaveLength(2);
    expect(md).toContain("<!-- Issue 1 de 2 -->\n**Título:** [Bug] O botão");
    expect(md).toContain("**Título:** [Outro] Gostei do calendário.");
    expect(md).toContain("- **Página:** —");
    expect(md).not.toContain("ana@exemplo.com");
  });

  it("Markdown agrupado: uma issue com cada mensagem citada", () => {
    const md = markdownAgrupado([base, outro]);
    expect(md.startsWith("**Título:** Feedback de usuários (2)")).toBe(true);
    expect(md).toContain("### 1. [Bug] O botão");
    expect(md).toContain("### 2. [Outro] Gostei do calendário.\n> Gostei do calendário.");
    expect(md).toContain("feedback #124");
  });

  it("JSON: array com os campos; e-mail só se pedido", () => {
    const [item] = JSON.parse(jsonFeedbacks([base]));
    expect(item).toEqual({
      id: 123,
      tipo: "BUG",
      status: "NOVO",
      titulo: "[Bug] O botão de salvar não responde no celular.",
      mensagem: base.mensagem,
      pagina: "/concursos/[id]",
      versaoApp: "2.7.0",
      commit: "a1b2c3d",
      navegador: "Mozilla/5.0 (Android)",
      recebidoEm: "2026-11-09T17:32:00.000Z",
    });
    expect(JSON.parse(jsonFeedbacks([base], { incluirEmail: true }))[0].usuario).toBe(
      "ana@exemplo.com",
    );
  });
});

describe("comandos gh", () => {
  it("título entre aspas simples, label pelo tipo e corpo num heredoc literal", () => {
    const cmd = comandoGh(base);
    expect(cmd.split("\n")[0]).toBe(
      "gh issue create --repo rkenjiak/concurso --title '[Bug] O botão de salvar não responde no celular.' --label bug --body-file - <<'FEEDBACK_123'",
    );
    expect(cmd.endsWith("\nFEEDBACK_123")).toBe(true);
    expect(comandoGh({ ...base, tipo: "SUGESTAO" })).toContain("--label enhancement");
    expect(comandoGh({ ...base, tipo: "OUTRO" })).not.toContain("--label");
  });

  it("escapa aspas simples no título", () => {
    expect(aspasShell("it's")).toBe("'it'\\''s'");
    expect(comandoGh({ ...base, mensagem: "não é 'bug'" }).split("\n")[0]).toContain(
      "--title '[Bug] não é '\\''bug'\\'''",
    );
  });

  it("troca o delimitador se uma linha do corpo for igual a ele", () => {
    expect(delimitadorHeredoc("a\nFEEDBACK_1\nb", "FEEDBACK_1")).toBe("FEEDBACK_1_X");
    expect(delimitadorHeredoc("FEEDBACK_1\nFEEDBACK_1_X", "FEEDBACK_1")).toBe("FEEDBACK_1_X_X");
    expect(delimitadorHeredoc("FEEDBACK_1 no meio", "FEEDBACK_1")).toBe("FEEDBACK_1");
    // Uma mensagem com o terminador numa linha: a citação (`> `) já o protege; o delimitador
    // aparece sozinho só na última linha.
    const linhas = comandoGh({ ...base, mensagem: MALICIOSA }).split("\n");
    expect(linhas).toContain("> FEEDBACK_123");
    expect(linhas.filter((l) => l === "FEEDBACK_123")).toHaveLength(1);
    expect(linhas.at(-1)).toBe("FEEDBACK_123");
  });

  it("cabeçalho com a quantidade e um comando por feedback", () => {
    const texto = comandosGh([base, { ...base, id: 7 }]);
    expect(texto.startsWith("# 2 issues: cole num terminal bash ou zsh")).toBe(true);
    expect(texto.match(/^gh issue create/gm)).toHaveLength(2);
  });

  // Executa os comandos num bash real com um `gh` falso: nada da mensagem é interpretado.
  const bash = spawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" });
  it.skipIf(bash.status !== 0)("no bash, título e corpo chegam ao gh sem expansão", () => {
    const itens = [
      { ...base, mensagem: MALICIOSA },
      { ...base, id: 9, tipo: "SUGESTAO" as const, mensagem: "it's `date` $(id)" },
    ];
    const script = [
      'gh() { printf "ARGS:%s\\n" "$@"; printf "CORPO<<\\n"; cat; printf ">>CORPO\\n"; }',
      comandosGh(itens),
    ].join("\n");
    const r = spawnSync("bash", ["-c", script], { encoding: "utf8" });
    expect(r.status).toBe(0);
    const saida = r.stdout.replace(/\r\n/g, "\n");
    for (const f of itens) {
      expect(saida).toContain(`ARGS:${tituloFeedback(f)}\n`);
      expect(saida).toContain(`CORPO<<\n${corpoFeedback(f)}\n>>CORPO`);
    }
    expect(saida).not.toMatch(/uid=|\/home\/|root/);
  });
});
