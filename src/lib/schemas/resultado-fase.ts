/** Schema de resultado por fase do concurso (RF05, ARQUITETURA.md §3.5). */
import { z } from "zod";
import { FASE, type Fase, SITUACAO_FASE, type SituacaoFase } from "@/domain/enums";
import { notaParaEntrada } from "../format";
import { decimalOpcional, inteiroOpcional, textoOpcional } from "./comum";

const classificacao = () =>
  inteiroOpcional().refine((v) => v === null || v >= 1, "A classificação começa em 1.");

export const resultadoFaseSchema = z
  .object({
    fase: z.enum(FASE, { error: "Selecione a fase." }),
    descricao: textoOpcional(120),
    nota: decimalOpcional(),
    notaMaxima: decimalOpcional(),
    notaCorte: decimalOpcional(),
    classificacaoGeral: classificacao(),
    classificacaoCotas: classificacao(),
    listaCotas: textoOpcional(40),
    situacao: z.enum(SITUACAO_FASE, { error: "Selecione a situação." }),
    observacao: textoOpcional(1000),
  })
  .superRefine((d, ctx) => {
    if (d.notaMaxima === null) return;
    for (const campo of ["nota", "notaCorte"] as const) {
      const valor = d[campo];
      if (valor !== null && valor > d.notaMaxima) {
        ctx.addIssue({
          code: "custom",
          path: [campo],
          message: "Não pode ser maior que a nota máxima.",
        });
      }
    }
  });

export type ResultadoFaseFormValores = z.input<typeof resultadoFaseSchema>;
export type ResultadoFaseDados = z.output<typeof resultadoFaseSchema>;

export const VALORES_INICIAIS_RESULTADO_FASE: ResultadoFaseFormValores = {
  fase: "OBJETIVA",
  descricao: "",
  nota: "",
  notaMaxima: "",
  notaCorte: "",
  classificacaoGeral: "",
  classificacaoCotas: "",
  listaCotas: "",
  situacao: "PENDENTE",
  observacao: "",
};

/** Resultado persistido usado para preencher o formulário de edição. */
export interface ResultadoFaseParaFormulario {
  fase: Fase;
  descricao: string | null;
  nota: number | null;
  notaMaxima: number | null;
  notaCorte: number | null;
  classificacaoGeral: number | null;
  classificacaoCotas: number | null;
  listaCotas: string | null;
  situacao: SituacaoFase;
  observacao: string | null;
}

const texto = (v: string | number | null) => (v == null ? "" : String(v));

/** Resultado do banco → valores do formulário. */
export function valoresDoResultadoFase(r: ResultadoFaseParaFormulario): ResultadoFaseFormValores {
  return {
    fase: r.fase,
    descricao: texto(r.descricao),
    nota: notaParaEntrada(r.nota),
    notaMaxima: notaParaEntrada(r.notaMaxima),
    notaCorte: notaParaEntrada(r.notaCorte),
    classificacaoGeral: texto(r.classificacaoGeral),
    classificacaoCotas: texto(r.classificacaoCotas),
    listaCotas: texto(r.listaCotas),
    situacao: r.situacao,
    observacao: texto(r.observacao),
  };
}
