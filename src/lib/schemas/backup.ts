/**
 * Formato do backup JSON (RF09, ARQUITETURA.md §5.3/§8.3). O arquivo carrega `schemaVersion`;
 * qualquer mudança incompatível no formato exige incrementar {@link VERSAO_BACKUP} (e, se
 * possível, converter versões antigas na importação).
 *
 * Instantes (UTC) circulam como strings ISO 8601; datas de calendário como `YYYY-MM-DD`.
 * `busca_normalizada` não é exportada: é derivada e recalculada na importação.
 *
 * Campos adicionados depois da versão 1 sem quebrar o formato (opcionais, com default na
 * importação, para aceitar backups antigos): `concursos[].validadeOcultaDashboard` e
 * `eventos[].ocultoDashboard` (prazos ocultos do dashboard, #44); `concursos[].cor` e
 * `concursos[].icone` (identificação visual, #46; ausentes = `null`, cor automática);
 * `concursos[].notificacoesSilenciadas`, `regrasNotificacao` e `notificacoes` (lembretes, #65:
 * regras personalizadas e estado de leitura/dispensa; ausentes = padrão, nada lido). Versões
 * antigas do app ignoram esses campos ao importar um backup novo.
 *
 * `versaoApp` (#118) é só informativo: a versão do app que exportou (ex.: `2.7.0`). Opcional e
 * ignorado na importação; a compatibilidade continua sendo checada por `schemaVersion`.
 */
import { z } from "zod";
import { COR_CONCURSO, ehIconeValido } from "@/domain/cores";
import {
  ESCOLARIDADE,
  ESFERA,
  FASE,
  SITUACAO_FASE,
  STATUS,
  TIPO_EVENTO,
  TIPO_LINK,
  UF,
} from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import { ANTECEDENCIA_MAXIMA, MAX_ANTECEDENCIAS } from "@/domain/notificacoes";
import { VALIDADE_MESES_MAX, VALIDADE_MESES_MIN } from "@/domain/validade";
import { normalizarTag } from "../normalize";
import { ehDataISO } from "../tz";

/** Identificador do formato, para rejeitar JSONs que não são backups deste app. */
export const APP_BACKUP = "concurso";
/** Versão atual do formato do backup. */
export const VERSAO_BACKUP = 1;
/** Valor exigido no campo `confirmacao` da importação (substitui todos os dados). */
export const CONFIRMACAO_IMPORTACAO = "SUBSTITUIR_TUDO";
/** Tamanho máximo aceito para o arquivo de backup (20 MB). */
export const TAMANHO_MAX_BACKUP = 20 * 1024 * 1024;

const id = z.int().positive();
const inteiro = z.int().nonnegative();
/** Limite generoso: o backup valida estrutura, não as regras de cada formulário. */
const texto = () => z.string().max(100_000);
const instante = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
const data = z.string().refine(ehDataISO, "Data inválida (esperado AAAA-MM-DD).");
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (esperado HH:mm).");
const decimal = z.number().nonnegative();

const concursoBackup = z.object({
  id,
  orgao: texto().min(1),
  cargo: texto().min(1),
  banca: texto().nullable(),
  esfera: z.enum(ESFERA).nullable(),
  uf: z
    .string()
    .refine((v) => (UF as readonly string[]).includes(v), "UF inválida.")
    .nullable(),
  cidade: texto().nullable(),
  escolaridade: z.enum(ESCOLARIDADE).nullable(),
  remuneracaoCentavos: inteiro.nullable(),
  taxaInscricaoCentavos: inteiro.nullable(),
  vagasAmpla: inteiro.nullable(),
  vagasCadastroReserva: inteiro.nullable(),
  possuiCadastroReserva: z.boolean(),
  vagasCotas: inteiro.nullable(),
  status: z.enum(STATUS),
  statusDesde: instante,
  observacoes: texto().nullable(),
  homologacaoData: data.nullable(),
  validadeMeses: z.int().min(VALIDADE_MESES_MIN).max(VALIDADE_MESES_MAX).nullable(),
  validadeProrrogada: z.boolean(),
  validadeFimManual: data.nullable(),
  validadeOcultaDashboard: z.boolean().default(false),
  cor: z.enum(COR_CONCURSO).nullable().default(null),
  icone: z.string().refine(ehIconeValido, "Ícone inválido.").nullable().default(null),
  notificacoesSilenciadas: z.boolean().default(false),
  createdAt: instante,
  updatedAt: instante,
});

const tagBackup = z.object({
  id,
  nome: texto().refine((n) => n !== "" && n === normalizarTag(n), "Tag não normalizada."),
});

const concursoTagBackup = z.object({ concursoId: id, tagId: id });

const linkBackup = z.object({
  id,
  concursoId: id,
  tipo: z.enum(TIPO_LINK),
  rotulo: texto().nullable(),
  url: z
    .string()
    .max(2_000)
    .regex(/^https?:\/\//i, "URL deve começar com http:// ou https://."),
  ordem: z.int(),
  createdAt: instante,
});

const eventoBackup = z.object({
  id,
  concursoId: id,
  tipo: z.enum(TIPO_EVENTO),
  titulo: texto().nullable(),
  data,
  hora: hora.nullable(),
  local: texto().nullable(),
  observacao: texto().nullable(),
  concluido: z.boolean(),
  concluidoEm: instante.nullable(),
  ocultoDashboard: z.boolean().default(false),
  createdAt: instante,
  updatedAt: instante,
});

const statusHistoricoBackup = z.object({
  id,
  concursoId: id,
  de: z.enum(STATUS).nullable(),
  para: z.enum(STATUS),
  alteradoEm: instante,
  observacao: texto().nullable(),
});

const resultadoFaseBackup = z.object({
  id,
  concursoId: id,
  fase: z.enum(FASE),
  descricao: texto().nullable(),
  ordem: z.int(),
  nota: decimal.nullable(),
  notaMaxima: decimal.nullable(),
  notaCorte: decimal.nullable(),
  classificacaoGeral: inteiro.nullable(),
  classificacaoCotas: inteiro.nullable(),
  listaCotas: texto().nullable(),
  situacao: z.enum(SITUACAO_FASE),
  observacao: texto().nullable(),
});

const anexoBackup = z.object({
  id,
  concursoId: id,
  nomeArquivo: texto().min(1),
  mime: texto().min(1),
  tamanhoBytes: inteiro,
  chaveStorage: texto().min(1),
  createdAt: instante,
});

const antecedencia = z.int().min(0).max(ANTECEDENCIA_MAXIMA);

const regraNotificacaoBackup = z.object({
  tipo: z.enum(TIPO_EVENTO),
  ativo: z.boolean(),
  antecedencias: z.array(antecedencia).min(1).max(MAX_ANTECEDENCIAS),
});

/** Estado de uma notificação: do evento (`eventoId`) ou do fim da validade (`eventoId` nulo). */
const notificacaoBackup = z.object({
  concursoId: id,
  eventoId: id.nullable(),
  antecedencia,
  lidaEm: instante.nullable(),
  dispensadaEm: instante.nullable(),
});

const dadosBackup = z.object({
  concursos: z.array(concursoBackup),
  tags: z.array(tagBackup),
  concursoTags: z.array(concursoTagBackup),
  links: z.array(linkBackup),
  eventos: z.array(eventoBackup),
  statusHistorico: z.array(statusHistoricoBackup),
  resultadosFase: z.array(resultadoFaseBackup),
  anexos: z.array(anexoBackup).default([]),
  regrasNotificacao: z.array(regraNotificacaoBackup).default([]),
  notificacoes: z.array(notificacaoBackup).default([]),
});

type Dados = z.output<typeof dadosBackup>;

/** Verifica IDs únicos, nomes de tag únicos e chaves estrangeiras (mensagens claras). */
function checarIntegridade(dados: Dados, ctx: z.RefinementCtx): void {
  const erro = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: "custom", message, path });

  const unicos = <T>(
    tabela: string,
    lista: readonly T[],
    chave: (item: T) => string | number,
    nome: string,
  ) => {
    const vistos = new Set<string | number>();
    lista.forEach((item, i) => {
      const k = chave(item);
      if (vistos.has(k)) erro(`${nome} repetido (${k}).`, [tabela, i]);
      vistos.add(k);
    });
    return vistos;
  };

  const concursos = unicos("concursos", dados.concursos, (c) => c.id, "ID de concurso");
  const tags = unicos("tags", dados.tags, (t) => t.id, "ID de tag");
  unicos("tags", dados.tags, (t) => t.nome, "Nome de tag");
  unicos(
    "concursoTags",
    dados.concursoTags,
    (ct) => `${ct.concursoId}/${ct.tagId}`,
    "Tag de concurso",
  );

  const filhos: [string, string, readonly { id?: number; concursoId: number }[]][] = [
    ["links", "link", dados.links],
    ["eventos", "evento", dados.eventos],
    ["statusHistorico", "histórico de status", dados.statusHistorico],
    ["resultadosFase", "resultado de fase", dados.resultadosFase],
    ["anexos", "anexo", dados.anexos],
    ["concursoTags", "tag de concurso", dados.concursoTags],
  ];
  for (const [tabela, nome, linhas] of filhos) {
    if (tabela !== "concursoTags") unicos(tabela, linhas, (l) => l.id ?? 0, `ID de ${nome}`);
    linhas.forEach((l, i) => {
      if (!concursos.has(l.concursoId)) {
        erro(`O ${nome} referencia um concurso inexistente (${l.concursoId}).`, [tabela, i]);
      }
    });
  }
  unicos(
    "regrasNotificacao",
    dados.regrasNotificacao,
    (r) => r.tipo,
    "Tipo de regra de notificação",
  );
  const eventos = new Map(dados.eventos.map((e) => [e.id, e.concursoId]));
  unicos(
    "notificacoes",
    dados.notificacoes,
    (n) => `${n.concursoId}/${n.eventoId ?? "validade"}/${n.antecedencia}`,
    "Estado de notificação",
  );
  dados.notificacoes.forEach((n, i) => {
    if (!concursos.has(n.concursoId)) {
      erro(`A notificação referencia um concurso inexistente (${n.concursoId}).`, [
        "notificacoes",
        i,
      ]);
    } else if (n.eventoId !== null && eventos.get(n.eventoId) !== n.concursoId) {
      erro(`A notificação referencia um evento inexistente (${n.eventoId}).`, ["notificacoes", i]);
    }
  });
  dados.concursoTags.forEach((ct, i) => {
    if (!tags.has(ct.tagId)) {
      erro(`A tag de concurso referencia uma tag inexistente (${ct.tagId}).`, ["concursoTags", i]);
    }
  });
}

export const backupSchema = z.object({
  app: z.literal(APP_BACKUP),
  schemaVersion: z.literal(VERSAO_BACKUP),
  versaoApp: z.string().max(100).optional(),
  exportadoEm: z.iso.datetime({ offset: true }),
  dados: dadosBackup.superRefine(checarIntegridade),
});

/** Backup como gravado no arquivo JSON (instantes em ISO 8601). */
export type BackupJson = z.input<typeof backupSchema>;
/** Backup validado, pronto para gravar no banco (instantes como `Date`). */
export type Backup = z.output<typeof backupSchema>;

const envelope = z.object({ app: z.unknown(), schemaVersion: z.unknown() }).loose();

function caminho(path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)),
    "",
  );
}

/**
 * Valida um backup já lido do JSON. Lança {@link ErroDominio} com uma mensagem clara quando o
 * arquivo não é um backup deste app, tem versão desconhecida ou dados inválidos.
 */
export function validarBackup(entrada: unknown): Backup {
  const env = envelope.safeParse(entrada);
  if (!env.success || env.data.app !== APP_BACKUP) {
    throw new ErroDominio("O arquivo não é um backup deste app.");
  }
  const versao = env.data.schemaVersion;
  if (versao !== VERSAO_BACKUP) {
    const maisNova =
      typeof versao === "number" && Number.isInteger(versao) && versao > VERSAO_BACKUP;
    throw new ErroDominio(
      maisNova
        ? `Este backup usa a versão ${versao} do formato, mais nova que a suportada (${VERSAO_BACKUP}). Atualize o app antes de importar.`
        : `Versão do backup não suportada (${String(versao)}). Versão suportada: ${VERSAO_BACKUP}.`,
    );
  }
  const r = backupSchema.safeParse(entrada);
  if (!r.success) {
    const issue = r.error.issues[0];
    const onde = issue ? caminho(issue.path) : "";
    throw new ErroDominio(
      `Backup inválido${onde ? ` em ${onde}` : ""}: ${issue?.message ?? "formato inesperado"}.`.replace(
        /\.\.$/,
        ".",
      ),
    );
  }
  return r.data;
}
