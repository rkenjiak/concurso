/** Schema de evento do concurso (RF04). */
import { z } from "zod";
import { TIPO_EVENTO } from "@/domain/enums";
import { ehDataISO } from "../tz";
import { textoOpcional } from "./comum";

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const eventoSchema = z.object({
  tipo: z.enum(TIPO_EVENTO, { error: "Selecione o tipo." }),
  titulo: textoOpcional(120),
  data: z
    .string({ error: "Informe a data." })
    .trim()
    .min(1, "Informe a data.")
    .refine(ehDataISO, "Data inválida."),
  hora: z
    .string()
    .trim()
    .refine((v) => v === "" || RE_HORA.test(v), "Hora inválida (use HH:mm).")
    .transform((v) => (v === "" ? null : v)),
  local: textoOpcional(200),
  observacao: textoOpcional(1000),
  concluido: z.boolean(),
});

export type EventoFormValores = z.input<typeof eventoSchema>;
export type EventoDados = z.output<typeof eventoSchema>;

export const VALORES_INICIAIS_EVENTO: EventoFormValores = {
  tipo: "INICIO_INSCRICOES",
  titulo: "",
  data: "",
  hora: "",
  local: "",
  observacao: "",
  concluido: false,
};

export const concluidoSchema = z.boolean({ error: "Valor inválido." });
