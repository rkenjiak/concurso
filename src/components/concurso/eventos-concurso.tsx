"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { TIPO_EVENTO, type TipoEvento } from "@/domain/enums";
import { opcoes, ROTULO_TIPO_EVENTO } from "@/domain/labels";
import { formatarData } from "@/lib/format";
import {
  type EventoFormValores,
  eventoSchema,
  VALORES_INICIAIS_EVENTO,
} from "@/lib/schemas/evento";
import { cn } from "@/lib/utils";
import { alternarConcluido, excluirEvento, salvarEvento } from "@/server/actions/eventos";
import { BotaoConfirmar } from "./botao-confirmar";
import { ariaCampo, Campo } from "./campo";

export interface EventoItem {
  id: number;
  tipo: TipoEvento;
  titulo: string | null;
  data: string;
  hora: string | null;
  local: string | null;
  observacao: string | null;
  concluido: boolean;
}

interface EventosConcursoProps {
  concursoId: number;
  /** Já ordenados por data/hora. */
  eventos: readonly EventoItem[];
}

const nomeEvento = (e: Pick<EventoItem, "titulo" | "tipo">) =>
  e.titulo ?? ROTULO_TIPO_EVENTO[e.tipo];

/** Lista e gerencia as datas e eventos do concurso (RF04). */
export function EventosConcurso({ concursoId, eventos }: EventosConcursoProps) {
  const router = useRouter();
  const [editando, setEditando] = useState<EventoItem | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [alternando, iniciarAlternar] = useTransition();

  function alternar(e: EventoItem, concluido: boolean) {
    setErro(null);
    iniciarAlternar(async () => {
      const r = await alternarConcluido(concursoId, e.id, concluido);
      if (r.ok) router.refresh();
      else setErro(r.erros._form?.[0] ?? "Não foi possível atualizar o evento.");
    });
  }

  return (
    <div className="space-y-4">
      {eventos.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum evento cadastrado. Adicione inscrições, vencimento do boleto, provas, recursos…
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {eventos.map((e) => {
            const nome = nomeEvento(e);
            const checkId = `evento-${e.id}-concluido`;
            return (
              <li key={e.id} className="flex items-start gap-3 p-3">
                <Checkbox
                  id={checkId}
                  className="mt-1"
                  checked={e.concluido}
                  disabled={alternando}
                  aria-label={`${e.concluido ? "Desmarcar" : "Marcar"} "${nome}" como concluído`}
                  onCheckedChange={(v) => alternar(e, v === true)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        e.concluido && "text-muted-foreground line-through",
                      )}
                    >
                      {nome}
                    </span>
                    {e.titulo ? (
                      <Badge variant="secondary">{ROTULO_TIPO_EVENTO[e.tipo]}</Badge>
                    ) : null}
                    {e.concluido ? <Badge variant="outline">Concluído</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" aria-hidden />
                      {formatarData(e.data)}
                    </span>
                    {e.hora ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" aria-hidden />
                        {e.hora}
                      </span>
                    ) : null}
                    {e.local ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{e.local}</span>
                      </span>
                    ) : null}
                  </div>
                  {e.observacao ? (
                    <p className="whitespace-pre-line text-sm">{e.observacao}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar evento ${nome}`}
                    onClick={() => setEditando(e)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <BotaoConfirmar
                    titulo="Excluir evento?"
                    descricao={`${nome} — ${formatarData(e.data)}`}
                    rotuloConfirmar="Excluir"
                    destrutivo
                    variante="ghost"
                    tamanho="icon"
                    rotuloAcessivel={`Excluir evento ${nome}`}
                    acao={() => excluirEvento(concursoId, e.id)}
                    aoConcluir={() => router.refresh()}
                  >
                    <Trash2 aria-hidden />
                  </BotaoConfirmar>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
      <Button variant="outline" onClick={() => setEditando("novo")}>
        <Plus aria-hidden />
        Adicionar evento
      </Button>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {editando !== null ? (
            <FormularioEvento
              key={editando === "novo" ? "novo" : editando.id}
              concursoId={concursoId}
              evento={editando === "novo" ? null : editando}
              aoConcluir={() => {
                setEditando(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FormularioEventoProps {
  concursoId: number;
  evento: EventoItem | null;
  aoConcluir: () => void;
}

const CAMPOS = ["tipo", "titulo", "data", "hora", "local", "observacao", "concluido"] as const;

function FormularioEvento({ concursoId, evento, aoConcluir }: FormularioEventoProps) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(eventoSchema),
    defaultValues: evento
      ? {
          tipo: evento.tipo,
          titulo: evento.titulo ?? "",
          data: evento.data,
          hora: evento.hora ?? "",
          local: evento.local ?? "",
          observacao: evento.observacao ?? "",
          concluido: evento.concluido,
        }
      : VALORES_INICIAIS_EVENTO,
  });

  const enviar = handleSubmit(() => {
    setErroGeral(null);
    const valores = getValues();
    iniciar(async () => {
      const r = await salvarEvento(concursoId, evento?.id ?? null, valores);
      if (r.ok) return aoConcluir();
      for (const campo of CAMPOS) {
        const msg = r.erros[campo]?.[0];
        if (msg) setError(campo, { message: msg });
      }
      setErroGeral(r.erros._form?.[0] ?? null);
    });
  });

  const erro = (campo: keyof EventoFormValores) => errors[campo]?.message;

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{evento ? "Editar evento" : "Novo evento"}</DialogTitle>
        <DialogDescription>Inscrições, boleto, provas, recursos, resultados…</DialogDescription>
      </DialogHeader>
      <Campo id="evento-tipo" rotulo="Tipo" obrigatorio erro={erro("tipo")}>
        <NativeSelect
          {...ariaCampo("evento-tipo", erro("tipo"))}
          className="w-full"
          {...register("tipo")}
        >
          {opcoes(TIPO_EVENTO, ROTULO_TIPO_EVENTO).map((o) => (
            <NativeSelectOption key={o.valor} value={o.valor}>
              {o.rotulo}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Campo>
      <Campo
        id="evento-titulo"
        rotulo="Título"
        dica="Opcional; se vazio, usa o tipo."
        erro={erro("titulo")}
      >
        <Input
          {...ariaCampo("evento-titulo", erro("titulo"), "dica")}
          placeholder="Ex.: Prova objetiva — manhã"
          {...register("titulo")}
        />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo id="evento-data" rotulo="Data" obrigatorio erro={erro("data")}>
          <Input {...ariaCampo("evento-data", erro("data"))} type="date" {...register("data")} />
        </Campo>
        <Campo id="evento-hora" rotulo="Hora" dica="Opcional." erro={erro("hora")}>
          <Input
            {...ariaCampo("evento-hora", erro("hora"), "dica")}
            type="time"
            {...register("hora")}
          />
        </Campo>
      </div>
      <Campo id="evento-local" rotulo="Local" erro={erro("local")}>
        <Input
          {...ariaCampo("evento-local", erro("local"))}
          placeholder="Ex.: Escola Estadual X — sala 12"
          {...register("local")}
        />
      </Campo>
      <Campo id="evento-observacao" rotulo="Observação" erro={erro("observacao")}>
        <Textarea
          {...ariaCampo("evento-observacao", erro("observacao"))}
          rows={3}
          {...register("observacao")}
        />
      </Campo>
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="concluido"
          render={({ field }) => (
            <Checkbox
              id="evento-concluido"
              ref={field.ref}
              checked={field.value}
              onCheckedChange={(v) => field.onChange(v === true)}
            />
          )}
        />
        <Label htmlFor="evento-concluido">Concluído</Label>
      </div>
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
