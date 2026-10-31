/** Schema da troca de status (RF03). */
import { z } from "zod";
import { STATUS } from "@/domain/enums";
import { textoOpcional } from "./comum";

export const alterarStatusSchema = z.object({
  para: z.enum(STATUS, { error: "Selecione o novo status." }),
  observacao: textoOpcional(500)
    .optional()
    .transform((v) => v ?? null),
});

export type AlterarStatusEntrada = z.input<typeof alterarStatusSchema>;
