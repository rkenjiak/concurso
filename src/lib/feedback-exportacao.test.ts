import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aspasShell,
  codigoInline,
  comandoGh,
  comandosGh,
  conteudoExportado,
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

/**
 * Mensagem hostil, mas inofensiva se o escape falhar: as substituições só imprimem um marcador ou
 * criam um arquivo sentinela na pasta temporária do teste (cwd), nunca apagam nada.
 */
const MALICIOSA = [
  // biome-ignore lint/suspicious/noTemplateCurlyInString: é o texto que o shell não pode expandir
  "Teste $(printf EXPANDIU) e `printf EXPANDIU` e ${HOME} e $((6*7)) e 'aspas' e \"duplas\"",
  "$(printf EXPANDIU > SENTINELA)",
  "FEEDBACK_123",
  "EOF",
  "fim\\",
].join("\n");

/**
 * Um bash POSIX de verdade para executar os comandos `gh`, ou o motivo de não haver.
 *
 * No Windows, `bash` no PATH costuma ser o lançador do WSL (`System32\bash.exe` ou
 * `WindowsApps\bash.exe`): ele roda em outra máquina, pode ficar esperando o WSL subir e devolve
 * `status: null` (foi o que travou o teste por ~96 s). Por isso aqui se procura só o Git Bash, por
 * caminho explícito, e cada candidato é testado com tempo-limite e stdin fechado.
 */
function encontrarBash(): { caminho: string } | { motivo: string } {
  const candidatos: string[] = [];
  if (process.platform === "win32") {
    const bases = [
      process.env.ProgramW6432,
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Programs") : undefined,
    ];
    for (const base of bases) if (base) candidatos.push(join(base, "Git", "bin", "bash.exe"));
    // A partir do git no PATH: <Git>\cmd\git.exe ou <Git>\mingw64\bin\git.exe.
    const git = spawnSync("where.exe", ["git"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    for (const linha of (git.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
      const pasta = dirname(linha.trim());
      candidatos.push(
        join(pasta, "..", "bin", "bash.exe"),
        join(pasta, "..", "..", "bin", "bash.exe"),
      );
    }
  } else {
    candidatos.push("/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash", "/opt/homebrew/bin/bash");
  }
  for (const caminho of new Set(candidatos)) {
    if (!existsSync(caminho)) continue;
    const r = spawnSync(caminho, ["--noprofile", "--norc", "-c", 'printf %s "$BASH_VERSION"'], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (r.status === 0 && /^\d/.test(r.stdout)) return { caminho };
  }
  return {
    motivo: "nenhum bash POSIX utilizável (Git Bash no Windows; /bin/bash no Linux e no macOS)",
  };
}

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

describe("menções e referências do GitHub", () => {
  const Z = "\u200b";
  const mensagem = "Fala @rkenjiak, veja #12 e org/repo#3 e ## título";

  it("ganham um espaço de largura zero depois de @ e # na citação e no título", () => {
    const corpo = corpoFeedback({ ...base, mensagem });
    expect(corpo).toContain(
      `> Fala @${Z}rkenjiak, veja #${Z}12 e org/repo#${Z}3 e #${Z}#${Z} título`,
    );
    const citacao = corpo.split("\n").filter((l) => l.startsWith(">"));
    expect(citacao.join("\n")).not.toMatch(/[@#][\w#]/);
    expect(corpo.startsWith("## Feedback de usuário\n")).toBe(true);
    expect(tituloFeedback({ ...base, mensagem })).toBe(
      `[Bug] Fala @${Z}rkenjiak, veja #${Z}12 e org/repo#${Z}3 e #${Z}#${Z} título`,
    );
  });

  it("valem também nos comandos gh e no Markdown agrupado", () => {
    expect(comandoGh({ ...base, mensagem })).toContain(`@${Z}rkenjiak`);
    expect(markdownAgrupado([{ ...base, mensagem }])).not.toContain("@rkenjiak");
  });

  it("navegador, e-mail e página vão como código inline: sem menções, links nem quebra da lista", () => {
    const hostil = {
      ...base,
      userAgent:
        "Bot @rkenjiak #12 [clique](https://mal.example) <img src=x> **x**\n- **Tipo:** Falso",
      usuario: "eva@x.com @rkenjiak `x`",
      pagina: "/a`b",
    };
    const corpo = corpoFeedback(hostil, { incluirEmail: true });
    const linhas = corpo.split("\n");
    // Nenhuma linha nova: o item falso não aparece como item da lista.
    expect(linhas.filter((l) => l.startsWith("- **Tipo:**"))).toEqual(["- **Tipo:** Bug"]);
    expect(corpo).toContain(
      "**Navegador:** `Bot @rkenjiak #12 [clique](https://mal.example) <img src=x> **x** - **Tipo:** Falso`",
    );
    expect(corpo).toContain("- **Usuário:** `` eva@x.com @rkenjiak `x` ``");
    expect(corpo).toContain("- **Página:** ``/a`b``");
    // Fora dos trechos de código, nada de menções.
    const foraDoCodigo = corpo.replace(/(`+)[^`]*?(?:`(?!\1)[^`]*?)*\1/g, "");
    expect(foraDoCodigo).not.toMatch(/@\w|\]\(|<img/);
  });

  it("codigoInline: cerca maior que as crases do texto e espaço só quando preciso", () => {
    expect(codigoInline("abc")).toBe("`abc`");
    expect(codigoInline("a`b")).toBe("``a`b``");
    expect(codigoInline("`a``")).toBe("``` `a`` ```");
    expect(codigoInline("  \n ")).toBe("—");
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
        "- **Versão:** 2.7.0 (a1b2c3d) · **Navegador:** `Mozilla/5.0 (Android)`",
        "- **Recebido em:** 09/11/2026 14:32",
        "- **Ref.:** feedback nº 123",
      ].join("\n"),
    );
  });

  it("com incluirEmail, traz o usuário", () => {
    expect(corpoFeedback(base, { incluirEmail: true })).toContain(
      "- **Usuário:** `ana@exemplo.com`",
    );
  });

  it("cita todas as linhas da mensagem, inclusive as vazias", () => {
    const corpo = corpoFeedback({ ...base, mensagem: "um\n\n- não é lista\r\ndois" });
    expect(corpo).toContain("> um\n>\n> - não é lista\n> dois");
  });
});

describe("conteudoExportado", () => {
  it("nada exportado (todos descartados no meio-tempo) não vira cópia nem download", () => {
    expect(conteudoExportado({ conteudo: "# 0 issues", exportados: 0 })).toBeNull();
    expect(conteudoExportado({ conteudo: "[]", exportados: 0 })).toBeNull();
    expect(conteudoExportado({ conteudo: "x", exportados: 2 })).toBe("x");
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
    expect(md).toContain("feedback nº 124");
    expect(md).not.toMatch(/#\d/);
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
  const bash = encontrarBash();
  const titulo = "no bash, título e corpo chegam ao gh sem expansão";
  if (!("caminho" in bash)) {
    it.skip(`${titulo} (pulado: ${bash.motivo})`, () => {});
    return;
  }
  it(titulo, () => {
    const itens = [
      { ...base, mensagem: MALICIOSA },
      { ...base, id: 8, mensagem: "oi @rkenjiak #1 FEEDBACK_8\nFEEDBACK_8" },
      { ...base, id: 9, tipo: "SUGESTAO" as const, mensagem: "it's `date` $(id)" },
    ];
    const script = [
      'gh() { printf "ARGS:%s\\n" "$@"; printf "CORPO<<\\n"; cat; printf ">>CORPO\\n"; }',
      comandosGh(itens),
    ].join("\n");
    const pasta = mkdtempSync(join(tmpdir(), "feedback-gh-"));
    try {
      // Script pelo stdin (que fecha ao fim da entrada), pasta e HOME temporários e tempo-limite:
      // nada fica esperando entrada nem toca em arquivos de verdade.
      const r = spawnSync(bash.caminho, ["--noprofile", "--norc", "-s"], {
        input: script,
        cwd: pasta,
        env: { ...process.env, HOME: pasta },
        encoding: "utf8",
        timeout: 15_000,
      });
      expect(
        r.status,
        JSON.stringify({ erro: r.error?.message, sinal: r.signal, stderr: r.stderr }),
      ).toBe(0);
      const saida = r.stdout.replace(/\r\n/g, "\n");
      for (const f of itens) {
        expect(saida).toContain(`ARGS:${tituloFeedback(f)}\n`);
        expect(saida).toContain(`CORPO<<\n${corpoFeedback(f)}\n>>CORPO`);
      }
      // O texto literal chegou; nenhuma substituição rodou.
      expect(saida).toContain("$(printf EXPANDIU)");
      expect(saida).toContain("`printf EXPANDIU`");
      // biome-ignore lint/suspicious/noTemplateCurlyInString: texto literal esperado
      expect(saida).toContain("${HOME}");
      expect(saida.replaceAll("printf EXPANDIU", "")).not.toContain("EXPANDIU");
      expect(saida).not.toContain(" 42 ");
      // HOME não expandiu: nem o caminho do Windows nem a forma POSIX do Git Bash (/c/...).
      const posix = pasta
        .replace(/\\/g, "/")
        .replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
      expect(saida).not.toContain(pasta);
      expect(saida).not.toContain(posix);
      expect(saida).not.toContain(basename(pasta));
      expect(saida).not.toMatch(/uid=\d/);
      expect(existsSync(join(pasta, "SENTINELA"))).toBe(false);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});
