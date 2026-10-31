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
