/**
 * Rótulos em pt-BR dos enums do domínio (ARQUITETURA.md §3.8, §7.2). A UI nunca exibe os valores
 * SNAKE_CASE diretamente: sempre passa por estes mapas.
 */
import type {
  AcaoAdmin,
  Escolaridade,
  Esfera,
  Fase,
  MotivoSemAcesso,
  OrigemAcesso,
  Papel,
  SituacaoFase,
  Status,
  TipoEvento,
  TipoLink,
  Uf,
} from "./enums";

export const ROTULO_STATUS: Readonly<Record<Status, string>> = {
  PREVISTO: "Previsto",
  EDITAL_PUBLICADO: "Edital publicado",
  INSCRITO: "Inscrito",
  PROVA_AGENDADA: "Prova agendada",
  PROVA_REALIZADA: "Prova realizada",
  AGUARDANDO_RESULTADO: "Aguardando resultado",
  APROVADO: "Aprovado",
  CLASSIFICADO: "Classificado",
  REPROVADO: "Reprovado",
  NOMEADO: "Nomeado",
  EMPOSSADO: "Empossado",
  DESISTIU: "Desistiu",
  NAO_INSCRITO: "Não inscrito",
  SUSPENSO: "Suspenso",
  CANCELADO: "Cancelado",
};

/** Explicação curta de cada status (dicas na UI). */
export const DESCRICAO_STATUS: Readonly<Record<Status, string>> = {
  PREVISTO: "Autorizado ou com comissão formada, ainda sem edital.",
  EDITAL_PUBLICADO: "Edital de abertura publicado.",
  INSCRITO: "Inscrição feita, taxa paga ou isenção deferida.",
  PROVA_AGENDADA: "Data e local de prova divulgados.",
  PROVA_REALIZADA: "Prova feita.",
  AGUARDANDO_RESULTADO: "Aguardando gabarito, recursos ou resultado.",
  APROVADO: "Aprovado dentro das vagas.",
  CLASSIFICADO: "Classificado fora das vagas (cadastro de reserva).",
  REPROVADO: "Eliminado ou não classificado.",
  NOMEADO: "Nomeação publicada.",
  EMPOSSADO: "Posse realizada.",
  DESISTIU: "Desistiu de participar.",
  NAO_INSCRITO: "Optou por não se inscrever.",
  SUSPENSO: "Concurso suspenso (pode ser retomado).",
  CANCELADO: "Concurso cancelado.",
};

export const ROTULO_ESFERA: Readonly<Record<Esfera, string>> = {
  FEDERAL: "Federal",
  ESTADUAL: "Estadual",
  MUNICIPAL: "Municipal",
  DISTRITAL: "Distrital",
};

export const ROTULO_ESCOLARIDADE: Readonly<Record<Escolaridade, string>> = {
  FUNDAMENTAL: "Ensino fundamental",
  MEDIO: "Ensino médio",
  TECNICO: "Técnico",
  SUPERIOR: "Ensino superior",
  POS_GRADUACAO: "Pós-graduação",
};

export const ROTULO_TIPO_LINK: Readonly<Record<TipoLink, string>> = {
  EDITAL_ABERTURA: "Edital de abertura",
  RETIFICACAO: "Retificação",
  PAGINA_BANCA: "Página da banca",
  AREA_CANDIDATO: "Área do candidato",
  GABARITO: "Gabarito",
  RESULTADO: "Resultado",
  CONVOCACAO: "Convocação",
  OUTRO: "Outro",
};

export const ROTULO_TIPO_EVENTO: Readonly<Record<TipoEvento, string>> = {
  PUBLICACAO_EDITAL: "Publicação do edital",
  INICIO_INSCRICOES: "Início das inscrições",
  FIM_INSCRICOES: "Fim das inscrições",
  PEDIDO_ISENCAO: "Pedido de isenção",
  VENCIMENTO_BOLETO: "Vencimento do boleto",
  PROVA_OBJETIVA: "Prova objetiva",
  PROVA_DISCURSIVA: "Prova discursiva",
  OUTRA_FASE: "Outra fase",
  GABARITO_PRELIMINAR: "Gabarito preliminar",
  PRAZO_RECURSO: "Prazo de recurso",
  RESULTADO_FINAL: "Resultado final",
  HOMOLOGACAO: "Homologação",
  CONVOCACAO: "Convocação",
  NOMEACAO: "Nomeação",
  POSSE: "Posse",
  VALIDADE: "Validade do concurso",
  OUTRO: "Outro",
};

export const ROTULO_FASE: Readonly<Record<Fase, string>> = {
  OBJETIVA: "Objetiva",
  DISCURSIVA: "Discursiva",
  TAF: "Teste de aptidão física (TAF)",
  TITULOS: "Títulos",
  PSICOTECNICO: "Psicotécnico",
  INVESTIGACAO_SOCIAL: "Investigação social",
  ORAL: "Prova oral",
  CURSO_FORMACAO: "Curso de formação",
  OUTRA: "Outra",
};

export const ROTULO_SITUACAO_FASE: Readonly<Record<SituacaoFase, string>> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  CLASSIFICADO: "Classificado",
  ELIMINADO: "Eliminado",
  SUB_JUDICE: "Sub judice",
};

export const ROTULO_UF: Readonly<Record<Uf, string>> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export const ROTULO_PAPEL: Readonly<Record<Papel, string>> = {
  USUARIO: "Usuário",
  ADMIN: "Admin",
};

export const ROTULO_ACAO_ADMIN: Readonly<Record<AcaoAdmin, string>> = {
  PROMOVER_ADMIN: "Promoveu a admin",
  REBAIXAR_ADMIN: "Rebaixou a usuário",
  BLOQUEAR_USUARIO: "Bloqueou",
  DESBLOQUEAR_USUARIO: "Desbloqueou",
  PERMITIR_EMAIL: "Liberou o acesso de",
  REMOVER_EMAIL: "Retirou da lista de acesso",
  REVOGAR_TOKENS: "Revogou os tokens (MCP e .ics) de",
};

export const ROTULO_ORIGEM_ACESSO: Readonly<Record<OrigemAcesso, string>> = {
  USUARIO_INICIAL: "Usuário inicial (senha ou uso sem login)",
  ADMIN_EMAILS: "ADMIN_EMAILS",
  ALLOWED_EMAILS: "ALLOWED_EMAILS",
  PAINEL: "Liberado no painel",
  PAPEL_ADMIN: "Papel admin",
};

export const ROTULO_MOTIVO_SEM_ACESSO: Readonly<Record<MotivoSemAcesso, string>> = {
  BLOQUEADO: "Bloqueado pelo painel.",
  LOGIN_GOOGLE_DESLIGADO: "O login Google está desligado: só o usuário inicial entra hoje.",
  SENHA_DESLIGADA:
    "Usuário inicial ainda sem conta Google e com o login por senha (APP_PASSWORD) desligado.",
  FORA_DAS_LISTAS:
    "O e-mail não está em ADMIN_EMAILS, ALLOWED_EMAILS nem liberado no painel, e não é admin.",
};

/** Lista `{ valor, rotulo }` na ordem do enum (para `<select>`). */
export function opcoes<T extends string>(
  valores: readonly T[],
  rotulos: Readonly<Record<T, string>>,
): { valor: T; rotulo: string }[] {
  return valores.map((valor) => ({ valor, rotulo: rotulos[valor] }));
}
