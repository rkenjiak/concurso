/**
 * Schema do banco (ARQUITETURA.md §3).
 *
 * Convenções:
 * - timestamps técnicos em UTC, `integer` epoch ms (`mode: "timestamp_ms"` → `Date` no TS);
 * - datas de calendário como `text` `YYYY-MM-DD` e horas como `text` `HH:mm` (horário de Brasília);
 * - dinheiro em centavos (`integer`), notas em `real`;
 * - enums como `text` com valores SNAKE_CASE;
 * - FKs filhas com `ON DELETE CASCADE`.
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { COR_CONCURSO } from "../../domain/cores";
import {
  ESCOLARIDADE,
  ESFERA,
  FASE,
  PAPEL,
  SITUACAO_FASE,
  STATUS,
  TIPO_EVENTO,
  TIPO_LINK,
} from "../../domain/enums";

/** Epoch ms atual no SQLite (default de banco para inserções fora do Drizzle). */
const agoraMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

const criadoEm = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(agoraMs)
    .$defaultFn(() => new Date());

const atualizadoEm = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(agoraMs)
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

/** ID do usuário inicial, criado pela migração multiusuário (#49): dono dos dados anteriores. */
export const ID_USUARIO_INICIAL = 1;

// usuario (#49). O usuário inicial nasce sem e-mail e é assumido pelo primeiro login Google de
// um e-mail em `ADMIN_EMAILS`; o login por senha (uso local) entra sempre como ele.
export const usuario = sqliteTable("usuario", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Minúsculo; `null` só no usuário inicial ainda não assumido. */
  email: text("email").unique(),
  /** `sub` do Google (identificador estável da conta). */
  googleSub: text("google_sub").unique(),
  nome: text("nome"),
  avatarUrl: text("avatar_url"),
  papel: text("papel", { enum: PAPEL }).notNull().default("USUARIO"),
  /** SHA-256 (hex) do token do MCP por HTTP; o token em si não é guardado. */
  mcpTokenHash: text("mcp_token_hash").unique(),
  ultimoAcessoEm: integer("ultimo_acesso_em", { mode: "timestamp_ms" }),
  createdAt: criadoEm(),
});

// 3.1 concurso (RF01, RF03, RF05)
export const concurso = sqliteTable(
  "concurso",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Dono do concurso (#49); links, eventos etc. pertencem a ele via concurso. */
    usuarioId: integer("usuario_id")
      .notNull()
      .references(() => usuario.id, { onDelete: "cascade" }),
    orgao: text("orgao").notNull(),
    cargo: text("cargo").notNull(),
    banca: text("banca"),
    esfera: text("esfera", { enum: ESFERA }),
    uf: text("uf", { length: 2 }),
    cidade: text("cidade"),
    escolaridade: text("escolaridade", { enum: ESCOLARIDADE }),
    remuneracaoCentavos: integer("remuneracao_centavos"),
    taxaInscricaoCentavos: integer("taxa_inscricao_centavos"),
    vagasAmpla: integer("vagas_ampla"),
    vagasCadastroReserva: integer("vagas_cadastro_reserva"),
    possuiCadastroReserva: integer("possui_cadastro_reserva", { mode: "boolean" })
      .notNull()
      .default(false),
    vagasCotas: integer("vagas_cotas"),
    status: text("status", { enum: STATUS }).notNull(),
    statusDesde: integer("status_desde", { mode: "timestamp_ms" }).notNull(),
    observacoes: text("observacoes"),
    homologacaoData: text("homologacao_data"),
    validadeMeses: integer("validade_meses"),
    validadeProrrogada: integer("validade_prorrogada", { mode: "boolean" })
      .notNull()
      .default(false),
    validadeFimManual: text("validade_fim_manual"),
    /** Oculta do dashboard o pseudo-evento de fim da validade (preferência de exibição, #44). */
    validadeOcultaDashboard: integer("validade_oculta_dashboard", { mode: "boolean" })
      .notNull()
      .default(false),
    /** Cor da paleta (#46); `null` = automática, derivada do ID (`domain/cores`). */
    cor: text("cor", { enum: COR_CONCURSO }),
    /** Ícone opcional (um emoji) exibido junto da cor (#46). */
    icone: text("icone"),
    buscaNormalizada: text("busca_normalizada").notNull().default(""),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [
    index("concurso_status_idx").on(t.status),
    index("concurso_usuario_idx").on(t.usuarioId, t.status),
  ],
);

// 3.2 link (RF02)
export const link = sqliteTable(
  "link",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    concursoId: integer("concurso_id")
      .notNull()
      .references(() => concurso.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPO_LINK }).notNull(),
    rotulo: text("rotulo"),
    url: text("url").notNull(),
    ordem: integer("ordem").notNull().default(0),
    createdAt: criadoEm(),
  },
  (t) => [index("link_concurso_idx").on(t.concursoId, t.ordem)],
);

// 3.3 evento (RF04)
export const evento = sqliteTable(
  "evento",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    concursoId: integer("concurso_id")
      .notNull()
      .references(() => concurso.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPO_EVENTO }).notNull(),
    titulo: text("titulo"),
    data: text("data").notNull(),
    hora: text("hora"),
    local: text("local"),
    observacao: text("observacao"),
    concluido: integer("concluido", { mode: "boolean" }).notNull().default(false),
    concluidoEm: integer("concluido_em", { mode: "timestamp_ms" }),
    /** Oculta o evento da lista de próximos prazos do dashboard (preferência de exibição, #44). */
    ocultoDashboard: integer("oculto_dashboard", { mode: "boolean" }).notNull().default(false),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [
    index("evento_data_concluido_idx").on(t.data, t.concluido),
    index("evento_concurso_idx").on(t.concursoId),
  ],
);

// 3.4 status_historico (RF03)
export const statusHistorico = sqliteTable(
  "status_historico",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    concursoId: integer("concurso_id")
      .notNull()
      .references(() => concurso.id, { onDelete: "cascade" }),
    de: text("de", { enum: STATUS }),
    para: text("para", { enum: STATUS }).notNull(),
    alteradoEm: integer("alterado_em", { mode: "timestamp_ms" }).notNull(),
    observacao: text("observacao"),
  },
  (t) => [index("status_historico_concurso_idx").on(t.concursoId, t.alteradoEm)],
);

// 3.5 resultado_fase (RF05)
export const resultadoFase = sqliteTable(
  "resultado_fase",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    concursoId: integer("concurso_id")
      .notNull()
      .references(() => concurso.id, { onDelete: "cascade" }),
    fase: text("fase", { enum: FASE }).notNull(),
    descricao: text("descricao"),
    ordem: integer("ordem").notNull().default(0),
    nota: real("nota"),
    notaMaxima: real("nota_maxima"),
    notaCorte: real("nota_corte"),
    classificacaoGeral: integer("classificacao_geral"),
    classificacaoCotas: integer("classificacao_cotas"),
    listaCotas: text("lista_cotas"),
    situacao: text("situacao", { enum: SITUACAO_FASE }).notNull().default("PENDENTE"),
    observacao: text("observacao"),
  },
  (t) => [index("resultado_fase_concurso_idx").on(t.concursoId, t.ordem)],
);

// 3.6 tag e concurso_tag (RF01)
export const tag = sqliteTable("tag", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Normalizado: trim + minúsculas. */
  nome: text("nome").notNull().unique(),
});

export const concursoTag = sqliteTable(
  "concurso_tag",
  {
    concursoId: integer("concurso_id")
      .notNull()
      .references(() => concurso.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.concursoId, t.tagId] }),
    index("concurso_tag_tag_idx").on(t.tagId),
  ],
);

// 3.7 anexo (pós-MVP, RF02 desejável) — tabela criada desde já para evitar migração futura.
export const anexo = sqliteTable(
  "anexo",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    concursoId: integer("concurso_id")
      .notNull()
      .references(() => concurso.id, { onDelete: "cascade" }),
    nomeArquivo: text("nome_arquivo").notNull(),
    mime: text("mime").notNull(),
    tamanhoBytes: integer("tamanho_bytes").notNull(),
    chaveStorage: text("chave_storage").notNull().unique(),
    createdAt: criadoEm(),
  },
  (t) => [index("anexo_concurso_idx").on(t.concursoId)],
);

export type Usuario = typeof usuario.$inferSelect;
export type NovoUsuario = typeof usuario.$inferInsert;
export type Concurso = typeof concurso.$inferSelect;
export type NovoConcurso = typeof concurso.$inferInsert;
export type Link = typeof link.$inferSelect;
export type NovoLink = typeof link.$inferInsert;
export type Evento = typeof evento.$inferSelect;
export type NovoEvento = typeof evento.$inferInsert;
export type StatusHistorico = typeof statusHistorico.$inferSelect;
export type NovoStatusHistorico = typeof statusHistorico.$inferInsert;
export type ResultadoFase = typeof resultadoFase.$inferSelect;
export type NovoResultadoFase = typeof resultadoFase.$inferInsert;
export type Tag = typeof tag.$inferSelect;
export type ConcursoTag = typeof concursoTag.$inferSelect;
export type Anexo = typeof anexo.$inferSelect;
export type NovoAnexo = typeof anexo.$inferInsert;
