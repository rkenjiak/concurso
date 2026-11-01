"use client";

import type { UseFormRegisterReturn } from "react-hook-form";
import {
  COR_CONCURSO,
  type CorConcurso,
  ROTULO_COR_CONCURSO,
  varCorConcurso,
} from "@/domain/cores";

const OPCAO =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-accent peer-checked:border-primary peer-checked:bg-accent peer-checked:font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-ring";

/**
 * Escolha da cor do concurso (#46): grupo de rádios nativos (setas do teclado navegam entre as
 * opções) com a amostra de cada cor da paleta. "Automática" grava `null`; `corAutomatica` é a cor
 * que o concurso recebe nesse caso (desconhecida na criação, antes de haver ID).
 */
export function CampoCorConcurso({
  registro,
  corAutomatica,
  erro,
}: {
  registro: UseFormRegisterReturn<"cor">;
  corAutomatica?: CorConcurso;
  erro?: string;
}) {
  return (
    <fieldset
      className="grid gap-1.5 sm:col-span-2"
      aria-describedby={erro ? "cor-erro" : "cor-dica"}
    >
      <legend className="mb-1.5 font-medium text-sm leading-none">Cor no calendário</legend>
      <div className="flex flex-wrap gap-2">
        <label>
          <input type="radio" value="" className="peer sr-only" {...registro} />
          <span className={OPCAO}>
            <span
              aria-hidden
              className="inline-block size-3 rounded-full border border-muted-foreground border-dashed"
              style={corAutomatica ? { backgroundColor: varCorConcurso(corAutomatica) } : undefined}
            />
            Automática
            {corAutomatica ? (
              <span className="text-muted-foreground">
                ({ROTULO_COR_CONCURSO[corAutomatica].toLowerCase()})
              </span>
            ) : null}
          </span>
        </label>
        {COR_CONCURSO.map((cor) => (
          <label key={cor}>
            <input type="radio" value={cor} className="peer sr-only" {...registro} />
            <span className={OPCAO} data-cor-concurso={cor}>
              <span
                aria-hidden
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: varCorConcurso(cor) }}
              />
              {ROTULO_COR_CONCURSO[cor]}
            </span>
          </label>
        ))}
      </div>
      {erro ? (
        <p id="cor-erro" role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : (
        <p id="cor-dica" className="text-muted-foreground text-xs">
          Identifica o concurso no calendário, no painel e nas listas. Os prazos críticos continuam
          destacados em vermelho e âmbar.
        </p>
      )}
    </fieldset>
  );
}
