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
import { centavosParaEntrada } from "../format";
import {
  enumOpcional,
  inteiroOpcional,
  moedaOpcional,
  textoObrigatorio,
  textoOpcional,
} from "./comum";

export const concursoSchema = z.object({
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
});

/** Na edição o status não muda pelo formulário (RF03: usa a troca de status com histórico). */
export const concursoEdicaoSchema = concursoSchema.omit({ status: true });

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
}

const texto = (v: string | number | null) => (v == null ? "" : String(v));

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
  };
}
