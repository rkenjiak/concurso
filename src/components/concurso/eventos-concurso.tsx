"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, CalendarPlus, Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  type Ref,
  startTransition,
  useEffect,
  useImperativeHandle,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { useAvisos } from "@/components/avisos/avisos";
import { classesDestaque, useDestaqueAlvo } from "@/components/evento/destaque";
import { NomeEvento } from "@/components/evento/nome-evento";
import { useFocoNoErro } from "@/components/formulario/use-foco-no-erro";
import { useProtecaoSaida } from "@/components/formulario/use-protecao-saida";
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
import { lerIdEvento } from "@/domain/navegacao-concurso";
import { nomePrazo } from "@/domain/prazos";
import { PARAM_EVENTO, urlSemParametro } from "@/lib/aba-concurso";
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

type Otimistas = ReadonlyMap<number, boolean>;
const SEM_OTIMISTAS: Otimistas = new Map();

/**
 * Lista e gerencia as datas e eventos do concurso (RF04). `?evento=<id>` (#100, D2) destaca o
 * evento: rola até ele, dá foco e marca `aria-current` enquanto o parâmetro existir. Id que não é
 * de um evento deste concurso (inválido, de outro concurso ou excluído) é removido da URL.
 *
 * Concluir/reabrir é otimista e por item (#100, item 14): só o evento em gravação fica ocupado; o
 * aviso "concluído" oferece Desfazer e, em falha, a marcação volta e o erro é anunciado.
 */
export function EventosConcurso({ concursoId, eventos }: EventosConcursoProps) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<EventoItem | "novo" | null>(null);
  const formularioRef = useRef<ControleSaida>(null);
  const [otimistas, aplicarOtimista] = useOptimistic(
    SEM_OTIMISTAS,
    (atual: Otimistas, { id, concluido }: { id: number; concluido: boolean }) =>
      new Map(atual).set(id, concluido),
  );
  const paramEvento = useSearchParams().get(PARAM_EVENTO);
  const idPedido = lerIdEvento(paramEvento);
  const alvoId = idPedido !== null && eventos.some((e) => e.id === idPedido) ? idPedido : null;
  const { ref: refAlvo, forte } = useDestaqueAlvo<HTMLLIElement>(alvoId);

  useEffect(() => {
    if (paramEvento !== null && alvoId === null) {
      window.history.replaceState(null, "", urlSemParametro(window.location.href, PARAM_EVENTO));
    }
  }, [paramEvento, alvoId]);

  /** Conclui ou reabre; a promessa termina com a gravação (o "Desfazer" do aviso a aguarda). */
  function alternar(e: EventoItem, concluido: boolean, desfazendo = false): Promise<void> {
    const nome = nomePrazo(e);
    const chave = `concluir-evento-${e.id}`;
    return new Promise<void>((resolver) => {
      startTransition(async () => {
        aplicarOtimista({ id: e.id, concluido });
        const r = await alternarConcluido(concursoId, e.id, concluido);
        if (!r.ok) {
          avisar({
            texto:
              r.erros._form?.[0] ??
              `Não foi possível ${concluido ? "concluir" : "reabrir"} “${nome}”.`,
            tipo: "erro",
            chave,
          });
        } else if (concluido) {
          avisar({
            texto: `“${nome}” concluído.`,
            chave,
            acao: {
              rotulo: "Desfazer",
              executar: async () => {
                await alternar(e, false, true);
                // O foco estava no aviso, que vai fechar: volta à caixa do evento.
                if (document.activeElement?.closest("[data-avisos]")) {
                  document.getElementById(`evento-${e.id}-concluido`)?.focus();
                }
              },
            },
          });
        } else if (!desfazendo) {
          avisar({ texto: `“${nome}” reaberto.`, chave });
        }
        resolver();
      });
    });
  }

  const fecharModal = () => setEditando(null);
  /** Quem abriu o modal (botão Adicionar ou Editar): recebe o foco quando ele fecha. */
  const gatilhoRef = useRef<HTMLElement | null>(null);
  const abrirModal = (alvo: EventoItem | "novo", gatilho: HTMLElement) => {
    gatilhoRef.current = gatilho;
    setEditando(alvo);
  };

  // Sem eventos, o CTA fica no estado vazio e em destaque (variante primária, #100, D9).
  const botaoAdicionar = (
    <Button
      variant={eventos.length === 0 ? "default" : "outline"}
      data-adicionar-evento=""
      onClick={(ev) => abrirModal("novo", ev.currentTarget)}
    >
      <Plus aria-hidden />
      Adicionar evento
    </Button>
  );

  return (
    <div className="space-y-4">
      {eventos.length === 0 ? (
        <section
          aria-labelledby="eventos-vazio-titulo"
          className="space-y-3 rounded-lg border border-dashed p-6 text-center"
        >
          <CalendarPlus className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <h3 id="eventos-vazio-titulo" className="font-medium">
              Cadastre as datas deste concurso
            </h3>
            <p className="mx-auto max-w-prose text-muted-foreground text-sm">
              Inscrições, vencimento do boleto, provas, recursos… As datas alimentam o dashboard, o
              calendário e os avisos de prazo.
            </p>
          </div>
          {botaoAdicionar}
        </section>
      ) : (
        <ul className="divide-y rounded-lg border">
          {eventos.map((e) => {
            const nome = nomePrazo(e);
            const checkId = `evento-${e.id}-concluido`;
            const alvo = e.id === alvoId;
            const concluido = otimistas.get(e.id) ?? e.concluido;
            const gravando = otimistas.has(e.id);
            return (
              <li
                key={e.id}
                id={`evento-${e.id}`}
                ref={alvo ? refAlvo : undefined}
                tabIndex={alvo ? -1 : undefined}
                aria-current={alvo ? "true" : undefined}
                data-destaque={alvo ? (forte ? "forte" : "sutil") : undefined}
                className={cn(
                  "flex items-start gap-3 p-3 first:rounded-t-lg last:rounded-b-lg",
                  classesDestaque(alvo, forte),
                )}
              >
                {/* Em gravação: `aria-disabled` (não `disabled`), para o foco não se perder. */}
                <Checkbox
                  id={checkId}
                  className="mt-1"
                  checked={concluido}
                  aria-disabled={gravando || undefined}
                  aria-busy={gravando || undefined}
                  aria-label={`${concluido ? "Desmarcar" : "Marcar"} "${nome}" como concluído`}
                  onCheckedChange={(v) => {
                    if (!gravando) void alternar(e, v === true);
                  }}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <NomeEvento
                      nome={nome}
                      concluido={concluido}
                      className={cn("font-medium", concluido && "text-muted-foreground")}
                    />
                    {e.titulo ? (
                      <Badge variant="secondary">{ROTULO_TIPO_EVENTO[e.tipo]}</Badge>
                    ) : null}
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
                    onClick={(ev) => abrirModal(e, ev.currentTarget)}
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
                    aoConcluir={() => avisar({ texto: `“${nome}” excluído.` })}
                  >
                    <Trash2 aria-hidden />
                  </BotaoConfirmar>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {eventos.length > 0 ? botaoAdicionar : null}

      {/* Esc, clique fora e o X passam pelo formulário: com alterações, pedem confirmação (D10). */}
      <Dialog
        open={editando !== null}
        onOpenChange={(aberto) => {
          if (aberto) return;
          if (formularioRef.current) formularioRef.current.sair(fecharModal);
          else fecharModal();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          onCloseAutoFocus={(ev) => {
            // Explícito: o retorno automático do Radix se perdia (o foco ia para o body). Se o
            // gatilho sumiu (ex.: estado vazio trocado pela lista), vale o botão Adicionar.
            const gatilho = gatilhoRef.current;
            const alvo = gatilho?.isConnected
              ? gatilho
              : document.querySelector<HTMLElement>("[data-adicionar-evento]");
            if (!alvo) return;
            ev.preventDefault();
            alvo.focus();
          }}
        >
          {editando !== null ? (
            <FormularioEvento
              key={editando === "novo" ? "novo" : editando.id}
              ref={formularioRef}
              concursoId={concursoId}
              evento={editando === "novo" ? null : editando}
              aoConcluir={(nome) => {
                avisar({ texto: `“${nome}” salvo.` });
                fecharModal();
              }}
              aoCancelar={fecharModal}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Saída protegida do formulário, para quem controla o modal (Esc, clique fora, X). */
export interface ControleSaida {
  /** Com alterações não salvas, pede confirmação antes de chamar `prosseguir` (#100, D10). */
  sair: (prosseguir: () => void) => void;
}

export interface FormularioEventoProps {
  concursoId: number;
  evento: EventoItem | null;
  /** Depois de salvar (com o nome do evento salvo, para o aviso). */
  aoConcluir: (nome: string) => void;
  /** Cancelar (já confirmado, se havia alterações). */
  aoCancelar: () => void;
  ref?: Ref<ControleSaida>;
}

const CAMPOS = ["tipo", "titulo", "data", "hora", "local", "observacao", "concluido"] as const;

/**
 * Formulário do modal de evento. Ao criar, "Salvar e adicionar outro" (#100, D9) salva, volta
 * todos os campos ao padrão (inclusive o tipo: cada data do edital costuma ser de um tipo
 * diferente — inscrições, boleto, prova — e manter o anterior induziria a erro) e devolve o foco
 * ao primeiro campo, anunciando o evento salvo. Também usado no painel do evento (#100).
 * Com alterações não salvas, Cancelar, fechar o modal (via `ref`), links e recarregar pedem
 * confirmação (D10); erro de validação leva o foco ao primeiro campo inválido.
 */
export function FormularioEvento({
  concursoId,
  evento,
  aoConcluir,
  aoCancelar,
  ref,
}: FormularioEventoProps) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    setFocus,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(eventoSchema),
    shouldFocusError: false,
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
  const { formRef, erroGeralRef, focarErro } = useFocoNoErro();
  const protecao = useProtecaoSaida(isDirty && !enviando);
  useImperativeHandle(ref, () => ({ sair: protecao.sair }), [protecao.sair]);

  // Foco no 1º campo depois de "Salvar e adicionar outro", só quando o envio termina: durante o
  // envio os botões ficam desabilitados e o navegador tiraria o foco de onde estivesse.
  useEffect(() => {
    if (salvo && !enviando) setFocus("tipo");
  }, [salvo, enviando, setFocus]);

  const enviar = (adicionarOutro: boolean) =>
    handleSubmit(
      () => {
        setErroGeral(null);
        setSalvo(null);
        const valores = getValues();
        iniciar(async () => {
          const r = await salvarEvento(concursoId, evento?.id ?? null, valores);
          if (r.ok && adicionarOutro) {
            reset(VALORES_INICIAIS_EVENTO);
            setSalvo(nomePrazo({ tipo: valores.tipo, titulo: valores.titulo?.trim() || null }));
            return;
          }
          if (r.ok) {
            return aoConcluir(
              nomePrazo({ tipo: valores.tipo, titulo: valores.titulo?.trim() || null }),
            );
          }
          let erroDeCampo = false;
          for (const campo of CAMPOS) {
            const msg = r.erros[campo]?.[0];
            if (msg) {
              setError(campo, { message: msg });
              erroDeCampo = true;
            }
          }
          setErroGeral(r.erros._form?.[0] ?? null);
          focarErro(erroDeCampo);
        });
      },
      () => focarErro(true),
    );

  const erro = (campo: keyof EventoFormValores) => errors[campo]?.message;

  return (
    <form ref={formRef} onSubmit={enviar(false)} noValidate className="grid gap-4">
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
        <p
          ref={erroGeralRef}
          role="alert"
          tabIndex={-1}
          className="text-destructive text-sm outline-none"
        >
          {erroGeral}
        </p>
      ) : null}
      {/* Sempre no DOM (região viva); sr-only enquanto vazia para não ocupar espaço. */}
      <p role="status" className={cn("text-muted-foreground text-sm", !salvo && "sr-only")}>
        {salvo ? `“${salvo}” salvo. Preencha o próximo evento.` : null}
      </p>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => protecao.sair(aoCancelar)}
          disabled={enviando}
        >
          Cancelar
        </Button>
        {evento ? null : (
          <Button type="button" variant="outline" onClick={enviar(true)} disabled={enviando}>
            Salvar e adicionar outro
          </Button>
        )}
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
      {protecao.dialogo}
    </form>
  );
}
