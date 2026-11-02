"use client";

import { Plus, X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_TAGS } from "@/lib/schemas/comum";
import { acaoDaTecla, deveBloquear, filtrarSugestoes, tagsDoTexto } from "@/lib/tags";
import { cn } from "@/lib/utils";

interface CampoTagsProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  /** Tags já usadas em outros concursos (reaproveitamento). */
  sugestoes: readonly string[];
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Entrada de tags livres: Enter, vírgula ou Tab adicionam; Backspace no campo vazio remove.
 * As sugestões são uma lista própria (combobox ARIA) em vez de `<datalist>`: o popup nativo
 * do navegador absorvia o Enter e impedia a adição da tag digitada.
 */
export function CampoTags({ id, value, onChange, sugestoes, ...aria }: CampoTagsProps) {
  const [texto, setTexto] = useState("");
  const [aberta, setAberta] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  const listaId = `${id}-sugestoes`;
  const cheio = value.length >= MAX_TAGS;

  const visiveis = aberta && !cheio ? filtrarSugestoes(sugestoes, value, texto) : [];

  function adicionar(bruto: string) {
    const novas = tagsDoTexto(bruto, value);
    if (novas.length > 0) onChange([...value, ...novas].slice(0, MAX_TAGS));
    setTexto("");
    setDestaque(-1);
  }

  function remover(nome: string) {
    onChange(value.filter((t) => t !== nome));
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    const estado = {
      key: e.key,
      compondo: e.nativeEvent.isComposing,
      texto,
      quantidade: value.length,
      sugestoes: visiveis,
      destaque,
    };
    const acao = acaoDaTecla(estado);
    if (deveBloquear(estado, acao)) e.preventDefault();
    switch (acao.tipo) {
      case "adicionar":
        adicionar(acao.valor);
        break;
      case "remover-ultima":
        onChange(value.slice(0, -1));
        break;
      case "destacar":
        setAberta(true);
        setDestaque(acao.indice);
        break;
      case "fechar":
        setAberta(false);
        setDestaque(-1);
        break;
    }
  }

  const destacada = destaque >= 0 && destaque < visiveis.length ? destaque : -1;

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
                  className="rounded-full p-0.5 hover:bg-foreground/10 pointer-coarse:-my-1 pointer-coarse:p-1.5"
                  aria-label={`Remover tag ${t}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative flex gap-2">
        <Input
          id={id}
          {...aria}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={visiveis.length > 0}
          aria-controls={listaId}
          aria-activedescendant={destacada >= 0 ? `${listaId}-${destacada}` : undefined}
          value={texto}
          placeholder={cheio ? "Limite de tags atingido" : "Digite e tecle Enter"}
          disabled={cheio}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            setTexto(e.target.value);
            setAberta(true);
            setDestaque(-1);
          }}
          onFocus={() => setAberta(true)}
          onKeyDown={aoTeclar}
          onBlur={() => {
            setAberta(false);
            setDestaque(-1);
            if (texto.trim()) adicionar(texto);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Adicionar tag"
          disabled={cheio || texto.trim() === ""}
          // Evita o blur do campo (que já adicionaria) antes do clique.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => adicionar(texto)}
        >
          <Plus aria-hidden />
        </Button>
        <div
          id={listaId}
          role="listbox"
          aria-label="Sugestões de tags"
          className={cn(
            "absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
            visiveis.length === 0 && "hidden",
          )}
        >
          {visiveis.map((s, i) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: navegação por teclado feita no combobox (setas + Enter).
            <div
              key={s}
              tabIndex={-1}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === destacada}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
                i === destacada ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              )}
              // `mousedown` com preventDefault mantém o foco no campo (sem blur).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => adicionar(s)}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
