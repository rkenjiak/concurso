/** Schema de link do concurso (RF02). */
import { z } from "zod";
import { TIPO_LINK } from "@/domain/enums";
import { textoOpcional } from "./comum";

/** `true` se `valor` é uma URL absoluta com protocolo http ou https. */
export function ehUrlHttp(valor: string): boolean {
  if (!URL.canParse(valor)) return false;
  const url = new URL(valor);
  return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
}

export const linkSchema = z.object({
  tipo: z.enum(TIPO_LINK, { error: "Selecione o tipo." }),
  rotulo: textoOpcional(100),
  url: z
    .string()
    .trim()
    .min(1, "Informe a URL.")
    .max(2000, "URL longa demais.")
    .refine(ehUrlHttp, "Informe uma URL começando com http:// ou https://."),
});

export type LinkFormValores = z.input<typeof linkSchema>;
export type LinkDados = z.output<typeof linkSchema>;

export const VALORES_INICIAIS_LINK: LinkFormValores = {
  tipo: "EDITAL_ABERTURA",
  rotulo: "",
  url: "",
};

/** Ordem dos links: lista de IDs sem repetição. */
export const ordemLinksSchema = z
  .array(z.number().int().positive())
  .refine((ids) => new Set(ids).size === ids.length, "Ordem inválida.");
