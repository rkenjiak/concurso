/**
 * Servidor MCP do app (issue #39): permite que uma LLM com acesso ao edital cadastre e atualize
 * concursos. Mesma definição para os dois transportes — stdio (`pnpm mcp`, uso local) e HTTP
 * (`/api/mcp`, hospedado, com o token pessoal do usuário). Cada instância é presa a um usuário
 * (#49) e só enxerga os dados dele.
 *
 * Ferramentas sem exclusão: os dados só são criados ou alterados.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod";
import { ESFERA, STATUS, UF } from "@/domain/enums";
import { JANELA_PADRAO_DIAS } from "@/domain/prazos";
import { version } from "../../../package.json";
import type { ResultadoAcao } from "../actions/resultado";
import type { Db } from "../db/client";
import {
  concursoNovoEntrada,
  concursoParcialEntrada,
  eventoLoteEntrada,
  eventoNovoEntrada,
  linkLoteEntrada,
  linkNovoEntrada,
  resultadoEntrada,
} from "./entradas";
import * as op from "./operacoes";
import { guiaCadastro, guiaRetificacao, INSTRUCOES, referencia } from "./textos";

export interface OpcoesServidorMcp {
  db: Db;
  /** Dono dos dados acessados (#49): o usuário do token (HTTP) ou o usuário inicial (stdio). */
  usuarioId: number;
  /** Chamado após cada escrita bem-sucedida (ex.: `revalidatePath` no Next). */
  aoAlterar?: () => void;
}

type Conteudo = { content: { type: "text"; text: string }[]; isError?: boolean };

const json = (dados: unknown): Conteudo => ({
  content: [{ type: "text", text: JSON.stringify(dados, null, 2) }],
});

const erro = (texto: string): Conteudo => ({
  content: [{ type: "text", text: texto }],
  isError: true,
});

/** Erros `{ campo: [mensagens] }` → texto legível para a LLM corrigir e tentar de novo. */
export function textoDosErros(erros: Record<string, string[] | undefined>): string {
  const linhas = Object.entries(erros).flatMap(([campo, mensagens]) =>
    (mensagens ?? []).map((m) => (campo === "_form" ? `- ${m}` : `- ${campo}: ${m}`)),
  );
  return `Nada foi gravado.\n${linhas.join("\n")}`;
}

const idConcurso = z.number().int().positive().describe("ID do concurso.");

const LEITURA = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const ESCRITA = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

export function criarServidorMcp({ db, usuarioId, aoAlterar }: OpcoesServidorMcp): McpServer {
  const servidor = new McpServer(
    { name: "concurso", title: "Concursos", version },
    { instructions: INSTRUCOES },
  );

  /** Converte o resultado padronizado e avisa sobre escritas bem-sucedidas. */
  const escrita = <T>(r: ResultadoAcao<T>, gravou = true): Conteudo => {
    if (!r.ok) return erro(textoDosErros(r.erros));
    if (gravou) aoAlterar?.();
    return json(r.data);
  };

  // --- Leituras ---------------------------------------------------------------------------

  servidor.registerTool(
    "listar_concursos",
    {
      title: "Listar concursos",
      description:
        "Lista os concursos cadastrados (por próxima data), com busca sem acento em órgão, " +
        "cargo, banca e tags, e filtros opcionais.",
      inputSchema: z.object({
        busca: z.string().optional().describe("Texto livre (ex.: 'trf analista')."),
        status: z.array(z.enum(STATUS)).optional().describe("Só estes status."),
        esfera: z.enum(ESFERA).optional(),
        uf: z.enum(UF).optional(),
      }),
      annotations: LEITURA,
    },
    async (filtros) => json(await op.listar(db, usuarioId, filtros)),
  );

  servidor.registerTool(
    "obter_concurso",
    {
      title: "Obter concurso",
      description:
        "Concurso completo: dados (valores em reais), eventos, links, tags, histórico de " +
        "status, resultados e os status para os quais pode mudar.",
      inputSchema: z.object({ id: idConcurso }),
      annotations: LEITURA,
    },
    async ({ id }) => {
      const ficha = await op.obterFicha(db, usuarioId, id);
      return ficha ? json(ficha) : erro("Concurso não encontrado.");
    },
  );

  servidor.registerTool(
    "proximos_prazos",
    {
      title: "Próximos prazos",
      description:
        "Prazos do painel: vencidos (críticos não concluídos), hoje e próximos dias, dos " +
        "concursos em andamento.",
      inputSchema: z.object({
        janelaDias: z
          .number()
          .int()
          .min(1)
          .max(365)
          .optional()
          .describe(`Dias à frente (padrão ${JANELA_PADRAO_DIAS}).`),
      }),
      annotations: LEITURA,
    },
    async ({ janelaDias }) =>
      json(await op.proximosPrazos(db, usuarioId, janelaDias ?? JANELA_PADRAO_DIAS)),
  );

  servidor.registerTool(
    "verificar_duplicado",
    {
      title: "Verificar duplicado",
      description:
        "Procura concursos já cadastrados com órgão e cargo parecidos. Use antes de cadastrar.",
      inputSchema: z.object({
        orgao: z.string().describe("Órgão do edital."),
        cargo: z.string().describe("Cargo escolhido."),
      }),
      annotations: LEITURA,
    },
    async (alvo) => json(await op.verificarDuplicados(db, usuarioId, alvo)),
  );

  // --- Escritas ---------------------------------------------------------------------------

  servidor.registerTool(
    "cadastrar_concurso",
    {
      title: "Cadastrar concurso a partir do edital",
      description:
        "Cadastra UM cargo de um edital de uma só vez: dados do concurso + eventos do " +
        "cronograma + links + tags, tudo ou nada. Use simular: true para validar e ver o que " +
        "seria gravado sem gravar. Recusa se houver concurso parecido, salvo " +
        "ignorarDuplicados: true (confirme com o usuário antes).",
      inputSchema: z.object({
        concurso: concursoNovoEntrada,
        eventos: z.array(eventoNovoEntrada).optional().describe("Cronograma do edital."),
        links: z.array(linkNovoEntrada).optional().describe("Edital, página da banca etc."),
        simular: z.boolean().optional().describe("Só validar e mostrar, sem gravar."),
        ignorarDuplicados: z
          .boolean()
          .optional()
          .describe("Cadastrar mesmo havendo concurso parecido."),
      }),
      annotations: { ...ESCRITA, idempotentHint: false },
    },
    async (entrada) => {
      const r = await op.cadastrar(db, usuarioId, entrada);
      return escrita(r, r.ok && !r.data.simulacao);
    },
  );

  servidor.registerTool(
    "atualizar_concurso",
    {
      title: "Atualizar concurso",
      description:
        "Altera só os campos informados do concurso (null limpa o campo; tags substituem as " +
        "atuais). Não muda o status — use alterar_status.",
      inputSchema: z.object({ id: idConcurso, campos: concursoParcialEntrada }),
      annotations: { ...ESCRITA, idempotentHint: true },
    },
    async ({ id, campos }) => escrita(await op.atualizar(db, usuarioId, id, campos)),
  );

  servidor.registerTool(
    "alterar_status",
    {
      title: "Alterar status",
      description:
        "Muda o status do concurso validando a transição e registrando no histórico (ex.: " +
        "EDITAL_PUBLICADO → INSCRITO após a inscrição). Em caso de recusa, informa os status " +
        "permitidos.",
      inputSchema: z.object({
        id: idConcurso,
        para: z.enum(STATUS).describe("Novo status."),
        observacao: z.string().optional().describe("Observação para o histórico."),
      }),
      annotations: { ...ESCRITA, idempotentHint: false },
    },
    async ({ id, ...entrada }) => escrita(await op.alterarStatus(db, usuarioId, id, entrada)),
  );

  servidor.registerTool(
    "salvar_eventos",
    {
      title: "Salvar eventos",
      description:
        "Cria (sem id; tipo e data obrigatórios) e altera (com id; só os campos informados) " +
        "eventos do concurso, tudo ou nada — ex.: aplicar o cronograma de uma retificação. " +
        "Não exclui eventos.",
      inputSchema: z.object({
        concursoId: idConcurso,
        eventos: z.array(eventoLoteEntrada).min(1),
      }),
      annotations: { ...ESCRITA, idempotentHint: false },
    },
    async ({ concursoId, eventos }) =>
      escrita(await op.salvarEventos(db, usuarioId, concursoId, eventos)),
  );

  servidor.registerTool(
    "salvar_links",
    {
      title: "Salvar links",
      description:
        "Cria (sem id; tipo e url obrigatórios) e altera (com id) links do concurso — edital, " +
        "retificações, gabarito, resultado, convocação. Não exclui links.",
      inputSchema: z.object({
        concursoId: idConcurso,
        links: z.array(linkLoteEntrada).min(1),
      }),
      annotations: { ...ESCRITA, idempotentHint: false },
    },
    async ({ concursoId, links }) =>
      escrita(await op.salvarLinks(db, usuarioId, concursoId, links)),
  );

  servidor.registerTool(
    "registrar_resultado",
    {
      title: "Registrar resultado",
      description:
        "Cria (sem id; fase obrigatória) ou altera (com id) o resultado do usuário em uma fase: " +
        "nota, nota de corte, classificação e situação.",
      inputSchema: resultadoEntrada.extend({ concursoId: idConcurso }),
      annotations: { ...ESCRITA, idempotentHint: false },
    },
    async ({ concursoId, ...entrada }) =>
      escrita(await op.registrarResultado(db, usuarioId, concursoId, entrada)),
  );

  // --- Recursos ---------------------------------------------------------------------------

  servidor.registerResource(
    "referencia",
    "concurso://referencia",
    {
      title: "Referência de valores",
      description: "Status (e transições), tipos de evento e link, fases, esfera e escolaridade.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: referencia() }],
    }),
  );

  servidor.registerResource(
    "concurso",
    new ResourceTemplate("concurso://concursos/{id}", {
      list: async () => ({
        resources: (await op.listar(db, usuarioId)).map((c) => ({
          uri: `concurso://concursos/${c.id}`,
          name: `${c.orgao} — ${c.cargo}`,
          mimeType: "application/json",
        })),
      }),
    }),
    { title: "Concurso", description: "Ficha completa do concurso.", mimeType: "application/json" },
    async (uri, { id }) => {
      const ficha = await op.obterFicha(db, usuarioId, Number(id));
      if (!ficha) throw new Error("Concurso não encontrado.");
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(ficha, null, 2) },
        ],
      };
    },
  );

  // --- Prompts ----------------------------------------------------------------------------

  servidor.registerPrompt(
    "cadastrar_edital",
    {
      title: "Cadastrar a partir do edital",
      description: "Guia para extrair do edital os dados de UM cargo e cadastrá-lo.",
      argsSchema: z.object({
        cargo: z.string().optional().describe("Cargo escolhido (se vazio, a LLM pergunta)."),
      }),
    },
    ({ cargo }) => ({
      messages: [{ role: "user", content: { type: "text", text: guiaCadastro(cargo) } }],
    }),
  );

  servidor.registerPrompt(
    "aplicar_retificacao",
    {
      title: "Aplicar retificação",
      description: "Compara uma retificação com o concurso cadastrado e aplica as mudanças.",
      argsSchema: z.object({ concursoId: z.string().describe("ID do concurso.") }),
    },
    ({ concursoId }) => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: guiaRetificacao(Number(concursoId)) },
        },
      ],
    }),
  );

  return servidor;
}
