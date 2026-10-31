/**
 * Schema do formulário de concurso (RF01), compartilhado entre cliente e servidor.
 */
import { z } from "zod";
import {
  ESCOLARIDADE,
  ESFERA,
  type Escolaridade,
  type Esfera,
  STATUS,
  type Status,
  UF,
} from "@/domain/enums";
import { VALIDADE_MESES_MAX, VALIDADE_MESES_MIN } from "@/domain/validade";
import { centavosParaEntrada } from "../format";
import {
  dataOpcional,
  enumOpcional,
  inteiroOpcional,
  moedaOpcional,
  tagsSchema,
  textoObrigatorio,
  textoOpcional,
} from "./comum";

/** Prazo de validade em meses (1–24) digitado como texto; vazio → `null`. */
const validadeMeses = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!/^\d+$/.test(v) || n < VALIDADE_MESES_MIN || n > VALIDADE_MESES_MAX) {
      ctx.addIssue({
        code: "custom",
        message: `Informe de ${VALIDADE_MESES_MIN} a ${VALIDADE_MESES_MAX} meses.`,
      });
      return z.NEVER;
    }
    return n;
  });

const camposConcurso = z.object({
  orgao: textoObrigatorio("Informe o nome ou órgão.", 200),
  cargo: textoObrigatorio("Informe o cargo ou área.", 200),
  banca: textoOpcional(100),
  esfera: enumOpcional(ESFERA, "Esfera inválida."),
  uf: enumOpcional(UF, "UF inválida."),
  cidade: textoOpcional(100),
  escolaridade: enumOpcional(ESCOLARIDADE, "Escolaridade inválida."),
  remuneracao: moedaOpcional,
  taxaInscricao: moedaOpcional,
  vagasAmpla: inteiroOpcional(),
  vagasCadastroReserva: inteiroOpcional(),
  possuiCadastroReserva: z.boolean(),
  vagasCotas: inteiroOpcional(),
  status: z.enum(STATUS, { error: "Selecione o status." }),
  observacoes: textoOpcional(20_000),
  tags: tagsSchema,
  // Validade (RF05, §4.3)
  homologacaoData: dataOpcional,
  validadeMeses,
  validadeProrrogada: z.boolean(),
  validadeFimManual: dataOpcional,
});

/** O fim manual da validade não pode ser anterior à homologação. */
function validarValidade(
  d: { homologacaoData: string | null; validadeFimManual: string | null },
  ctx: z.RefinementCtx,
) {
  if (d.homologacaoData && d.validadeFimManual && d.validadeFimManual < d.homologacaoData) {
    ctx.addIssue({
      code: "custom",
      path: ["validadeFimManual"],
      message: "O fim da validade não pode ser anterior à homologação.",
    });
  }
}

export const concursoSchema = camposConcurso.superRefine(validarValidade);

/** Na edição o status não muda pelo formulário (RF03: usa a troca de status com histórico). */
export const concursoEdicaoSchema = camposConcurso
  .omit({ status: true })
  .superRefine(validarValidade);

/** Nomes dos campos do formulário (para mapear erros do servidor). */
export const CAMPOS_CONCURSO = Object.keys(camposConcurso.shape);

/** Valores crus do formulário (strings, como digitados). */
export type ConcursoFormValores = z.input<typeof concursoSchema>;
/** Dados validados e normalizados para persistência. */
export type ConcursoDados = z.output<typeof concursoSchema>;
export type ConcursoEdicaoDados = z.output<typeof concursoEdicaoSchema>;

export const VALORES_INICIAIS_CONCURSO: ConcursoFormValores = {
  orgao: "",
  cargo: "",
  banca: "",
  esfera: "",
  uf: "",
  cidade: "",
  escolaridade: "",
  remuneracao: "",
  taxaInscricao: "",
  vagasAmpla: "",
  vagasCadastroReserva: "",
  possuiCadastroReserva: false,
  vagasCotas: "",
  status: "PREVISTO",
  observacoes: "",
  tags: [],
  homologacaoData: "",
  validadeMeses: "",
  validadeProrrogada: false,
  validadeFimManual: "",
};

/** Campos do concurso persistido usados para preencher o formulário de edição. */
export interface ConcursoParaFormulario {
  orgao: string;
  cargo: string;
  banca: string | null;
  esfera: Esfera | null;
  uf: string | null;
  cidade: string | null;
  escolaridade: Escolaridade | null;
  remuneracaoCentavos: number | null;
  taxaInscricaoCentavos: number | null;
  vagasAmpla: number | null;
  vagasCadastroReserva: number | null;
  possuiCadastroReserva: boolean;
  vagasCotas: number | null;
  status: Status;
  observacoes: string | null;
  tags?: readonly string[];
  homologacaoData?: string | null;
  validadeMeses?: number | null;
  validadeProrrogada?: boolean;
  validadeFimManual?: string | null;
}

const texto = (v: string | number | null | undefined) => (v == null ? "" : String(v));

/** Concurso do banco → valores do formulário. */
export function valoresDoConcurso(c: ConcursoParaFormulario): ConcursoFormValores {
  return {
    orgao: c.orgao,
    cargo: c.cargo,
    banca: texto(c.banca),
    esfera: c.esfera ?? "",
    uf: (c.uf ?? "") as ConcursoFormValores["uf"],
    cidade: texto(c.cidade),
    escolaridade: c.escolaridade ?? "",
    remuneracao: centavosParaEntrada(c.remuneracaoCentavos),
    taxaInscricao: centavosParaEntrada(c.taxaInscricaoCentavos),
    vagasAmpla: texto(c.vagasAmpla),
    vagasCadastroReserva: texto(c.vagasCadastroReserva),
    possuiCadastroReserva: c.possuiCadastroReserva,
    vagasCotas: texto(c.vagasCotas),
    status: c.status,
    observacoes: texto(c.observacoes),
    tags: [...(c.tags ?? [])],
    homologacaoData: texto(c.homologacaoData),
    validadeMeses: texto(c.validadeMeses),
    validadeProrrogada: c.validadeProrrogada ?? false,
    validadeFimManual: texto(c.validadeFimManual),
  };
}
