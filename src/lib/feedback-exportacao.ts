/**
 * Exportação do feedback para issues do GitHub (#117), em funções puras usadas pela prévia no
 * diálogo (cliente) e pela Server Action (servidor), que gera o conteúdo definitivo.
 *
 * Formatos: Markdown com uma issue por feedback, Markdown com uma issue agrupando todos, JSON e
 * comandos `gh issue create`. Por padrão sem o e-mail do usuário (as issues são públicas).
 *
 * Nos comandos `gh`, a mensagem nunca é interpolada no shell: o corpo vai num heredoc com
 * delimitador entre aspas (`<<'FEEDBACK_12'`), que desliga `$()`, crases e variáveis, e o
 * delimitador muda se alguma linha do corpo for igual a ele. O título vai entre aspas simples.
 *
 * Menções e referências do GitHub na mensagem e no título (`@usuario`, `#12`, `org/repo#12`) são
 * neutralizadas com um espaço de largura zero depois de `@` e `#`: a issue não notifica ninguém nem
 * cria links cruzados por causa do texto do usuário. A referência ao feedback é `feedback nº 123`.
 */
import type { StatusFeedback, TipoFeedback } from "@/domain/enums";
import { LABEL_GITHUB_FEEDBACK, semCaracteresDeControle } from "@/domain/feedback";
import { ROTULO_TIPO_FEEDBACK } from "@/domain/labels";
import { formatarDataHora } from "./format";
import type { FormatoExportacaoFeedback } from "./schemas/feedback";
import { REPOSITORIO_GITHUB } from "./versao";

export interface FeedbackExportavel {
  id: number;
  tipo: TipoFeedback;
  mensagem: string;
  pagina: string | null;
  versaoApp: string;
  commitApp: string;
  userAgent: string | null;
  /** E-mail (ou descrição) do usuário no envio. */
  usuario: string;
  status: StatusFeedback;
  createdAt: Date;
}

export interface OpcoesExportacao {
  /** Inclui o e-mail do usuário (padrão: não). */
  incluirEmail?: boolean;
}

const TAMANHO_TITULO = 60;

/** Quebras de linha no padrão Unix e sem caracteres de controle (exceto tab e quebra). */
function limparTexto(texto: string): string {
  return semCaracteresDeControle(texto.replace(/\r\n?/g, "\n"), "", "\n\t");
}

/** Espaço de largura zero (U+200B), invisível na issue. */
export const ESPACO_ZERO = "\u200b";

/** Neutraliza menções (`@usuario`) e referências (`#12`, `org/repo#12`) do GitHub. */
export function semMencoes(texto: string): string {
  return texto.replace(/[@#]/g, (c) => `${c}${ESPACO_ZERO}`);
}

/** `[Bug] primeiros 60 caracteres…` (uma linha, espaços colapsados, sem menções). */
export function tituloFeedback(f: Pick<FeedbackExportavel, "tipo" | "mensagem">): string {
  const linha = limparTexto(f.mensagem).replace(/\s+/g, " ").trim();
  const resumo =
    linha.length > TAMANHO_TITULO ? `${linha.slice(0, TAMANHO_TITULO).trimEnd()}…` : linha;
  return `[${ROTULO_TIPO_FEEDBACK[f.tipo]}] ${semMencoes(resumo)}`;
}

/** Mensagem como citação Markdown (`> ` em cada linha, inclusive as vazias), sem menções. */
function citar(mensagem: string): string {
  return semMencoes(limparTexto(mensagem))
    .trim()
    .split("\n")
    .map((l) => (l.trim() === "" ? ">" : `> ${l}`))
    .join("\n");
}

/** Texto inline num item de lista: uma linha só. */
function inline(texto: string): string {
  return limparTexto(texto).replace(/\s+/g, " ").trim();
}

/**
 * Texto livre (navegador, e-mail, página) como código inline: no GitHub nada dentro dele vira
 * menção, referência, link, HTML ou formatação, e numa linha só ele não quebra a lista. A cerca
 * usa mais crases que a maior sequência do texto (regra do CommonMark), com espaços quando o texto
 * começa ou termina em crase.
 */
export function codigoInline(texto: string): string {
  const t = inline(texto);
  if (t === "") return "—";
  const maior = Math.max(0, ...(t.match(/`+/g) ?? []).map((c) => c.length));
  const cerca = "`".repeat(maior + 1);
  const espaco = t.startsWith("`") || t.endsWith("`") ? " " : "";
  return `${cerca}${espaco}${t}${espaco}${cerca}`;
}

function metadados(f: FeedbackExportavel, opcoes: OpcoesExportacao): string[] {
  const linhas = [
    `- **Tipo:** ${ROTULO_TIPO_FEEDBACK[f.tipo]}`,
    `- **Página:** ${f.pagina ? codigoInline(f.pagina) : "—"}`,
    `- **Versão:** ${inline(f.versaoApp)} (${inline(f.commitApp)}) · **Navegador:** ${
      f.userAgent ? codigoInline(f.userAgent) : "—"
    }`,
    `- **Recebido em:** ${formatarDataHora(f.createdAt)}`,
  ];
  if (opcoes.incluirEmail) linhas.push(`- **Usuário:** ${codigoInline(f.usuario)}`);
  linhas.push(`- **Ref.:** feedback nº ${f.id}`);
  return linhas;
}

/** Corpo da issue de um feedback. */
export function corpoFeedback(f: FeedbackExportavel, opcoes: OpcoesExportacao = {}): string {
  return ["## Feedback de usuário", citar(f.mensagem), "", ...metadados(f, opcoes)].join("\n");
}

/** Uma issue por feedback: título sugerido e corpo, em blocos separados. */
export function markdownIssues(
  itens: readonly FeedbackExportavel[],
  opcoes: OpcoesExportacao = {},
): string {
  return itens
    .map((f, i) =>
      [
        `<!-- Issue ${i + 1} de ${itens.length} -->`,
        `**Título:** ${tituloFeedback(f)}`,
        "",
        corpoFeedback(f, opcoes),
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

/** Uma issue agrupando todos: título sugerido e cada mensagem citada com seus dados. */
export function markdownAgrupado(
  itens: readonly FeedbackExportavel[],
  opcoes: OpcoesExportacao = {},
): string {
  const blocos = itens.map((f, i) =>
    [`### ${i + 1}. ${tituloFeedback(f)}`, citar(f.mensagem), "", ...metadados(f, opcoes)].join(
      "\n",
    ),
  );
  return [
    `**Título:** Feedback de usuários (${itens.length})`,
    "",
    "## Feedbacks de usuários",
    "",
    blocos.join("\n\n"),
  ].join("\n");
}

/** Array JSON com os campos (para scripts). */
export function jsonFeedbacks(
  itens: readonly FeedbackExportavel[],
  opcoes: OpcoesExportacao = {},
): string {
  return JSON.stringify(
    itens.map((f) => ({
      id: f.id,
      tipo: f.tipo,
      status: f.status,
      titulo: tituloFeedback(f),
      mensagem: f.mensagem,
      pagina: f.pagina,
      versaoApp: f.versaoApp,
      commit: f.commitApp,
      navegador: f.userAgent,
      recebidoEm: f.createdAt.toISOString(),
      ...(opcoes.incluirEmail ? { usuario: f.usuario } : {}),
    })),
    null,
    2,
  );
}

/** Texto entre aspas simples para o shell (`'` vira `'\''`). */
export function aspasShell(texto: string): string {
  return `'${texto.replace(/'/g, "'\\''")}'`;
}

/** Delimitador do heredoc que não aparece como linha do corpo. */
export function delimitadorHeredoc(corpo: string, base: string): string {
  const linhas = new Set(corpo.split("\n"));
  let delimitador = base;
  while (linhas.has(delimitador)) delimitador = `${delimitador}_X`;
  return delimitador;
}

/** `gh issue create` de um feedback, com o corpo num heredoc literal. */
export function comandoGh(f: FeedbackExportavel, opcoes: OpcoesExportacao = {}): string {
  const corpo = limparTexto(corpoFeedback(f, opcoes));
  const delimitador = delimitadorHeredoc(corpo, `FEEDBACK_${f.id}`);
  const label = LABEL_GITHUB_FEEDBACK[f.tipo];
  const partes = [
    "gh issue create",
    `--repo ${REPOSITORIO_GITHUB}`,
    `--title ${aspasShell(tituloFeedback(f))}`,
    ...(label ? [`--label ${label}`] : []),
    "--body-file -",
    `<<'${delimitador}'`,
  ];
  return `${partes.join(" ")}\n${corpo}\n${delimitador}`;
}

/** Todos os comandos, prontos para colar num terminal bash/zsh com o `gh` autenticado. */
export function comandosGh(
  itens: readonly FeedbackExportavel[],
  opcoes: OpcoesExportacao = {},
): string {
  return [
    `# ${itens.length} ${itens.length === 1 ? "issue" : "issues"}: cole num terminal bash ou zsh com o gh autenticado.`,
    ...itens.map((f) => comandoGh(f, opcoes)),
  ].join("\n\n");
}

/** Conteúdo exportado no formato escolhido. */
export function exportarFeedbacksComo(
  formato: FormatoExportacaoFeedback,
  itens: readonly FeedbackExportavel[],
  opcoes: OpcoesExportacao = {},
): string {
  switch (formato) {
    case "MARKDOWN_ISSUES":
      return markdownIssues(itens, opcoes);
    case "MARKDOWN_AGRUPADO":
      return markdownAgrupado(itens, opcoes);
    case "JSON":
      return jsonFeedbacks(itens, opcoes);
    case "GH":
      return comandosGh(itens, opcoes);
  }
}

export const MENSAGEM_NADA_EXPORTADO =
  "Nenhum item foi exportado (já descartados?). Nada foi copiado nem baixado.";

/**
 * O que copiar ou baixar depois da ação de exportar: o conteúdo do servidor, ou `null` quando
 * nenhum item mudou (todos descartados nesse meio-tempo) — aí não se copia um texto vazio nem se
 * baixa um JSON vazio.
 */
export function conteudoExportado(resultado: {
  conteudo: string;
  exportados: number;
}): string | null {
  return resultado.exportados > 0 ? resultado.conteudo : null;
}

/** Nome do arquivo baixado no formato JSON. */
export function nomeArquivoFeedbacks(agora: Date): string {
  return `feedbacks-${agora.toISOString().slice(0, 10)}.json`;
}
