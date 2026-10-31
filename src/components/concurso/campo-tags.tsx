"use client";

import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { normalizarTag } from "@/lib/normalize";
import { MAX_TAGS } from "@/lib/schemas/comum";

interface CampoTagsProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  /** Tags já usadas em outros concursos (reaproveitamento). */
  sugestoes: readonly string[];
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Entrada de tags livres: Enter, vírgula ou Tab adicionam; Backspace no campo vazio remove. */
export function CampoTags({ id, value, onChange, sugestoes, ...aria }: CampoTagsProps) {
  const [texto, setTexto] = useState("");
  const listaId = `${id}-sugestoes`;

  function adicionar(bruto: string) {
    const nomes = bruto
      .split(",")
      .map(normalizarTag)
      .filter((n) => n !== "" && !value.includes(n));
    if (nomes.length > 0) onChange([...value, ...new Set(nomes)]);
    setTexto("");
  }

  function remover(nome: string) {
    onChange(value.filter((t) => t !== nome));
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "," || (e.key === "Tab" && texto.trim())) && texto) {
      e.preventDefault();
      adicionar(texto);
    } else if (e.key === "Backspace" && texto === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const disponiveis = sugestoes.filter((s) => !value.includes(s));

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags adicionadas">
          {value.map((t) => (
            <li key={t}>
              <Badge variant="secondary" className="h-6 gap-1 pr-1">
                {t}
                <button
                  type="button"
                  onClick={() => remover(t)}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  aria-label={`Remover tag ${t}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        id={id}
        {...aria}
        list={listaId}
        value={texto}
        placeholder={value.length >= MAX_TAGS ? "Limite de tags atingido" : "Digite e tecle Enter"}
        disabled={value.length >= MAX_TAGS}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(e) => {
          const v = e.target.value;
          // Seleção de uma sugestão do datalist adiciona direto.
          if (disponiveis.includes(v)) adicionar(v);
          else setTexto(v);
        }}
        onKeyDown={aoTeclar}
        onBlur={() => texto.trim() && adicionar(texto)}
      />
      <datalist id={listaId}>
        {disponiveis.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
