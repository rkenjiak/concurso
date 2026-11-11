/**
 * Enums do domínio (ARQUITETURA.md §3.8). Valores em SNAKE_CASE, armazenados como `text`
 * no banco. Rótulos em pt-BR ficam em `labels.ts`.
 */

export const STATUS = [
  "PREVISTO",
  "EDITAL_PUBLICADO",
  "INSCRITO",
  "PROVA_AGENDADA",
  "PROVA_REALIZADA",
  "AGUARDANDO_RESULTADO",
  "APROVADO",
  "CLASSIFICADO",
  "REPROVADO",
  "NOMEADO",
  "EMPOSSADO",
  "DESISTIU",
  "NAO_INSCRITO",
  "SUSPENSO",
  "CANCELADO",
] as const;
export type Status = (typeof STATUS)[number];

export const ESFERA = ["FEDERAL", "ESTADUAL", "MUNICIPAL", "DISTRITAL"] as const;
export type Esfera = (typeof ESFERA)[number];

export const ESCOLARIDADE = [
  "FUNDAMENTAL",
  "MEDIO",
  "TECNICO",
  "SUPERIOR",
  "POS_GRADUACAO",
] as const;
export type Escolaridade = (typeof ESCOLARIDADE)[number];

export const TIPO_LINK = [
  "EDITAL_ABERTURA",
  "RETIFICACAO",
  "PAGINA_BANCA",
  "AREA_CANDIDATO",
  "GABARITO",
  "RESULTADO",
  "CONVOCACAO",
  "OUTRO",
] as const;
export type TipoLink = (typeof TIPO_LINK)[number];

export const TIPO_EVENTO = [
  "PUBLICACAO_EDITAL",
  "INICIO_INSCRICOES",
  "FIM_INSCRICOES",
  "PEDIDO_ISENCAO",
  "VENCIMENTO_BOLETO",
  "PROVA_OBJETIVA",
  "PROVA_DISCURSIVA",
  "OUTRA_FASE",
  "GABARITO_PRELIMINAR",
  "PRAZO_RECURSO",
  "RESULTADO_FINAL",
  "HOMOLOGACAO",
  "CONVOCACAO",
  "NOMEACAO",
  "POSSE",
  "VALIDADE",
  "OUTRO",
] as const;
export type TipoEvento = (typeof TIPO_EVENTO)[number];

export const FASE = [
  "OBJETIVA",
  "DISCURSIVA",
  "TAF",
  "TITULOS",
  "PSICOTECNICO",
  "INVESTIGACAO_SOCIAL",
  "ORAL",
  "CURSO_FORMACAO",
  "OUTRA",
] as const;
export type Fase = (typeof FASE)[number];

export const SITUACAO_FASE = [
  "PENDENTE",
  "APROVADO",
  "CLASSIFICADO",
  "ELIMINADO",
  "SUB_JUDICE",
] as const;
export type SituacaoFase = (typeof SITUACAO_FASE)[number];

/** Siglas das unidades federativas (validação de `concurso.uf`). */
export const UF = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export type Uf = (typeof UF)[number];

/** Papel do usuário (#49): `ADMIN` gerencia a instância (painel, #50). */
export const PAPEL = ["USUARIO", "ADMIN"] as const;
export type Papel = (typeof PAPEL)[number];

/** Ações administrativas registradas na auditoria (#50). */
export const ACAO_ADMIN = [
  "PROMOVER_ADMIN",
  "REBAIXAR_ADMIN",
  "BLOQUEAR_USUARIO",
  "DESBLOQUEAR_USUARIO",
  "PERMITIR_EMAIL",
  "REMOVER_EMAIL",
  /** Revoga os tokens pessoais (MCP e .ics) sem bloquear (#108). Só em TS: a coluna é texto. */
  "REVOGAR_TOKENS",
  /** Feedback (#117): um registro por lote, com a quantidade no alvo ("5 feedbacks"). */
  "EXPORTAR_FEEDBACK",
  "DESCARTAR_FEEDBACK",
  /** Restaurar da aba Descartados ou desfazer um descarte. */
  "RESTAURAR_FEEDBACK",
  "EXCLUIR_FEEDBACK",
] as const;
export type AcaoAdmin = (typeof ACAO_ADMIN)[number];

/** Tipo do feedback enviado pelo usuário (#117). */
export const TIPO_FEEDBACK = ["BUG", "SUGESTAO", "OUTRO"] as const;
export type TipoFeedback = (typeof TIPO_FEEDBACK)[number];

/** Situação do feedback na caixa de entrada do admin (#117). */
export const STATUS_FEEDBACK = ["NOVO", "EXPORTADO", "DESCARTADO"] as const;
export type StatusFeedback = (typeof STATUS_FEEDBACK)[number];

/**
 * O que dá acesso hoje a um usuário (#108), na mesma regra de `donoDoTokenAutorizado`: o usuário
 * inicial pela senha (ou sem login configurado); os demais pelo login Google, com o e-mail em
 * `ADMIN_EMAILS`, `ALLOWED_EMAILS` ou liberado no painel, ou com o papel admin.
 */
export const ORIGEM_ACESSO = [
  "USUARIO_INICIAL",
  "ADMIN_EMAILS",
  "ALLOWED_EMAILS",
  "PAINEL",
  "PAPEL_ADMIN",
] as const;
export type OrigemAcesso = (typeof ORIGEM_ACESSO)[number];

/** Por que um usuário cadastrado está sem acesso hoje (#108). */
export const MOTIVO_SEM_ACESSO = [
  "BLOQUEADO",
  "LOGIN_GOOGLE_DESLIGADO",
  /** Usuário inicial sem conta Google e sem `APP_PASSWORD`: não há como entrar. */
  "SENHA_DESLIGADA",
  "FORA_DAS_LISTAS",
] as const;
export type MotivoSemAcesso = (typeof MOTIVO_SEM_ACESSO)[number];
