"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useAvisos } from "@/components/avisos/avisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TIPO_LINK, type TipoLink } from "@/domain/enums";
import { opcoes, ROTULO_TIPO_LINK } from "@/domain/labels";
import { type LinkFormValores, linkSchema, VALORES_INICIAIS_LINK } from "@/lib/schemas/link";
import { excluirLink, reordenarLinks, salvarLink } from "@/server/actions/links";
import { BotaoConfirmar } from "./botao-confirmar";
import { ariaCampo, Campo } from "./campo";

export interface LinkItem {
  id: number;
  tipo: TipoLink;
  rotulo: string | null;
  url: string;
}

interface LinksConcursoProps {
  concursoId: number;
  links: readonly LinkItem[];
}

/** Lista e gerencia os links do concurso (RF02). Links externos abrem em nova aba com segurança. */
export function LinksConcurso({ concursoId, links }: LinksConcursoProps) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<LinkItem | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [movendo, iniciarMover] = useTransition();

  function mover(indice: number, delta: -1 | 1) {
    const ids = links.map((l) => l.id);
    const alvo = indice + delta;
    const a = ids[indice];
    const b = ids[alvo];
    if (a === undefined || b === undefined) return;
    ids[indice] = b;
    ids[alvo] = a;
    setErro(null);
    iniciarMover(async () => {
      const r = await reordenarLinks(concursoId, ids);
      if (!r.ok) setErro(r.erros._form?.[0] ?? "Não foi possível reordenar.");
    });
  }

  return (
    <div className="space-y-4">
      {links.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum link cadastrado. Adicione o edital, a página da banca, a área do candidato…
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {links.map((l, i) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                >
                  <span className="truncate">{l.rotulo ?? ROTULO_TIPO_LINK[l.tipo]}</span>
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">(abre em nova aba)</span>
                </a>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <Badge variant="secondary">{ROTULO_TIPO_LINK[l.tipo]}</Badge>
                  <span className="truncate text-muted-foreground text-xs">{l.url}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mover para cima"
                  disabled={i === 0 || movendo}
                  onClick={() => mover(i, -1)}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mover para baixo"
                  disabled={i === links.length - 1 || movendo}
                  onClick={() => mover(i, 1)}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar link ${l.rotulo ?? ROTULO_TIPO_LINK[l.tipo]}`}
                  onClick={() => setEditando(l)}
                >
                  <Pencil aria-hidden />
                </Button>
                <BotaoConfirmar
                  titulo="Excluir link?"
                  descricao={l.rotulo ?? ROTULO_TIPO_LINK[l.tipo]}
                  rotuloConfirmar="Excluir"
                  destrutivo
                  variante="ghost"
                  tamanho="icon"
                  rotuloAcessivel={`Excluir link ${l.rotulo ?? ROTULO_TIPO_LINK[l.tipo]}`}
                  acao={() => excluirLink(concursoId, l.id)}
                  aoConcluir={() =>
                    avisar({ texto: `Link “${l.rotulo ?? ROTULO_TIPO_LINK[l.tipo]}” excluído.` })
                  }
                >
                  <Trash2 aria-hidden />
                </BotaoConfirmar>
              </div>
            </li>
          ))}
        </ul>
      )}
      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
      <Button variant="outline" onClick={() => setEditando("novo")}>
        <Plus aria-hidden />
        Adicionar link
      </Button>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          {editando !== null ? (
            <FormularioLink
              key={editando === "novo" ? "novo" : editando.id}
              concursoId={concursoId}
              link={editando === "novo" ? null : editando}
              aoConcluir={() => {
                avisar({ texto: editando === "novo" ? "Link adicionado." : "Link salvo." });
                setEditando(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FormularioLinkProps {
  concursoId: number;
  link: LinkItem | null;
  aoConcluir: () => void;
}

function FormularioLink({ concursoId, link, aoConcluir }: FormularioLinkProps) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(linkSchema),
    defaultValues: link
      ? { tipo: link.tipo, rotulo: link.rotulo ?? "", url: link.url }
      : VALORES_INICIAIS_LINK,
  });

  const enviar = handleSubmit(() => {
    setErroGeral(null);
    const valores = getValues();
    iniciar(async () => {
      const r = await salvarLink(concursoId, link?.id ?? null, valores);
      if (r.ok) return aoConcluir();
      for (const campo of ["tipo", "rotulo", "url"] as const) {
        const msg = r.erros[campo]?.[0];
        if (msg) setError(campo, { message: msg });
      }
      setErroGeral(r.erros._form?.[0] ?? null);
    });
  });

  const erro = (campo: keyof LinkFormValores) => errors[campo]?.message;

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{link ? "Editar link" : "Novo link"}</DialogTitle>
        <DialogDescription>Edital, retificações, página da banca, gabaritos…</DialogDescription>
      </DialogHeader>
      <Campo id="link-tipo" rotulo="Tipo" obrigatorio erro={erro("tipo")}>
        <NativeSelect
          {...ariaCampo("link-tipo", erro("tipo"))}
          className="w-full"
          {...register("tipo")}
        >
          {opcoes(TIPO_LINK, ROTULO_TIPO_LINK).map((o) => (
            <NativeSelectOption key={o.valor} value={o.valor}>
              {o.rotulo}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Campo>
      <Campo
        id="link-rotulo"
        rotulo="Rótulo"
        dica="Opcional; se vazio, usa o tipo."
        erro={erro("rotulo")}
      >
        <Input
          {...ariaCampo("link-rotulo", erro("rotulo"), "dica")}
          placeholder="Ex.: Edital nº 1/2026"
          {...register("rotulo")}
        />
      </Campo>
      <Campo id="link-url" rotulo="URL" obrigatorio erro={erro("url")}>
        <Input
          {...ariaCampo("link-url", erro("url"))}
          type="url"
          inputMode="url"
          placeholder="https://"
          {...register("url")}
        />
      </Campo>
      {erroGeral ? (
        <p role="alert" className="text-destructive text-sm">
          {erroGeral}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
