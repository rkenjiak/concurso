"use client";

import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Clock,
  EyeOff,
  MapPin,
  Pencil,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { type ControleSaida, FormularioEvento } from "@/components/concurso/eventos-concurso";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { SugestaoStatus } from "@/components/concurso/sugestao-status";
import { BotaoOcultarPrazo } from "@/components/dashboard/botao-ocultar-prazo";
import { BadgeSituacao } from "@/components/evento/badge-situacao";
import { NomeEvento } from "@/components/evento/nome-evento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hrefPrazo, type Origem } from "@/domain/navegacao-concurso";
import type { EventoPainel } from "@/domain/painel-evento";
import type { PendenciaStatus } from "@/domain/sugestao-status";
import { formatarData, formatarDataLonga } from "@/lib/format";
import { cn } from "@/lib/utils";
import { alternarConcluido as alternarConcluidoAcao } from "@/server/actions/eventos";

/** Atributo dos botões que abrem o painel: devolver o foco ao item depois de "Desfazer". */
const ATRIBUTO_GATILHO = "data-painel-chave";

interface ApiPainel {
  /** Abre o painel do item; `gatilho` recebe o foco de volta ao fechar. */
  abrir: (chave: string, gatilho?: HTMLElement | null) => void;
  /** Estado de conclusão exibido: o otimista enquanto a action não termina, senão `atual`. */
  concluido: (chave: string, atual: boolean) => boolean;
  /** A conclusão do item está sendo gravada. */
  gravando: (chave: string) => boolean;
  /** Conclui ou reabre o evento, com aviso e "Desfazer" (#100, D5). */
  alternarConcluido: (chave: string, concluido: boolean, gatilho?: HTMLElement | null) => void;
}

const ContextoPainel = createContext<ApiPainel | null>(null);

export function usePainelEvento(): ApiPainel {
  const api = useContext(ContextoPainel);
  if (!api) throw new Error("usePainelEvento precisa estar dentro de <PainelEventoProvider>.");
  return api;
}

interface Aberto {
  chave: string;
  /** Últimos dados vistos: o item pode sair da lista (concluído/oculto) com o painel aberto. */
  ultimo: EventoPainel;
  modo: "detalhes" | "editar";
}

type Otimistas = ReadonlyMap<string, boolean>;
const SEM_OTIMISTAS: Otimistas = new Map();

const seletorGatilho = (chave: string) => `[${ATRIBUTO_GATILHO}="${CSS.escape(chave)}"]`;

/** Gatilho visível do item (a grade e a agenda do calendário renderizam um cada). */
function gatilhoVisivel(chave: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(seletorGatilho(chave))) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/**
 * Devolve o foco quando ele se perdeu (no `body`, num elemento removido, num aviso que fechou ou
 * em `perdidoEm`): a cada quadro tenta `alvo()`; depois de `limiteMs`, usa `reserva`. Se o
 * usuário já moveu o foco para outro lugar, não faz nada.
 */
function devolverFoco(
  alvo: () => HTMLElement | null,
  reserva: HTMLElement | null,
  perdidoEm: HTMLElement | null = null,
  limiteMs = 3000,
) {
  const inicio = performance.now();
  const passo = () => {
    const ativo = document.activeElement;
    const perdido =
      !ativo ||
      ativo === document.body ||
      !ativo.isConnected ||
      ativo === perdidoEm ||
      ativo.closest("[data-avisos]") !== null;
    if (!perdido) return;
    const el = alvo();
    if (el) return el.focus();
    if (performance.now() - inicio > limiteMs) return reserva?.focus();
    requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/**
 * Painel de evento reutilizável (#100, itens 6–9; D3, D5, D6): no calendário e em "Próximos
 * prazos" do dashboard, clicar no evento abre os detalhes com as ações — concluir/reabrir,
 * ocultar do dashboard, editar e "Ver no concurso". Um provider por tela guarda o painel aberto e
 * o estado otimista de conclusão, compartilhado entre o botão de concluir da linha e o painel.
 *
 * - Drawer inferior abaixo de `md`, diálogo centralizado no desktop (Radix Dialog, `gaveta`).
 * - O painel sobrevive à saída do item da lista (no dashboard, concluir/ocultar o remove):
 *   mostra os últimos dados vistos.
 * - Concluir mostra "“X” concluído." com "Desfazer"; em falha, o estado volta e há aviso de erro.
 *   Se o concurso passa a ter uma pendência de status desse evento, ela aparece no painel (que é
 *   aberto, se a conclusão veio da linha).
 * - Ao fechar, o foco volta ao gatilho (ou, se ele sumiu, ao gatilho do item ou à lista).
 *
 * `itens` são os dados atuais da tela (serializáveis, de {@link paraPainel}).
 */
export function PainelEventoProvider({
  itens,
  origem,
  className,
  children,
}: {
  itens: readonly EventoPainel[];
  /** Origem do "Ver no concurso" (voltar à tela, D1). */
  origem: Origem;
  className?: string;
  children: ReactNode;
}) {
  const { avisar } = useAvisos();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [pendencia, setPendencia] = useState<{ chave: string; dados: PendenciaStatus } | null>(
    null,
  );
  const [otimistas, aplicarOtimista] = useOptimistic(
    SEM_OTIMISTAS,
    (atual: Otimistas, { chave, concluido }: { chave: string; concluido: boolean }) =>
      new Map(atual).set(chave, concluido),
  );
  const raizRef = useRef<HTMLDivElement>(null);
  /** Formulário de edição aberto no painel: fechar com alterações pede confirmação (D10). */
  const formularioRef = useRef<ControleSaida>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);
  const ultimaChaveRef = useRef<string | null>(null);
  const itensRef = useRef(itens);
  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);
  const abertoRef = useRef(aberto);
  useEffect(() => {
    abertoRef.current = aberto;
  }, [aberto]);

  const buscar = useCallback(
    (chave: string): EventoPainel | undefined =>
      itensRef.current.find((i) => i.chave === chave) ??
      (aberto?.chave === chave ? aberto.ultimo : undefined),
    [aberto],
  );

  // Mantém os "últimos dados vistos" do item aberto a cada nova lista do servidor. Só quando a
  // lista muda: abrir o painel pela pendência (com o item já concluído) antes de a lista nova
  // chegar não pode ser desfeito pelos dados antigos.
  const atualDaLista = aberto ? itens.find((i) => i.chave === aberto.chave) : undefined;
  useEffect(() => {
    setAberto((a) => {
      const atual = a && itens.find((i) => i.chave === a.chave);
      return a && atual && a.ultimo !== atual ? { ...a, ultimo: atual } : a;
    });
  }, [itens]);

  const atualizarUltimo = useCallback((chave: string, parcial: Partial<EventoPainel>) => {
    setAberto((a) => (a && a.chave === chave ? { ...a, ultimo: { ...a.ultimo, ...parcial } } : a));
  }, []);

  const abrir = useCallback((chave: string, gatilho?: HTMLElement | null) => {
    const item = itensRef.current.find((i) => i.chave === chave);
    if (!item) return;
    gatilhoRef.current = gatilho ?? null;
    ultimaChaveRef.current = chave;
    setAberto({ chave, ultimo: item, modo: "detalhes" });
  }, []);

  const alternarConcluido = useCallback(
    /** Recebe o item (não a chave): "Desfazer" precisa dele mesmo depois que sai da lista. */
    function alternar(
      item: EventoPainel,
      concluido: boolean,
      gatilho: HTMLElement | null = null,
      desfazendo = false,
    ): Promise<boolean> {
      const { chave, evento } = item;
      if (!evento) return Promise.resolve(false);
      return new Promise<boolean>((resolver) => {
        startTransition(async () => {
          aplicarOtimista({ chave, concluido });
          const r = await alternarConcluidoAcao(item.concurso.id, evento.id, concluido);
          if (!r.ok) {
            avisar({
              texto:
                r.erros._form?.[0] ??
                `Não foi possível ${concluido ? "concluir" : "reabrir"} “${item.nome}”.`,
              tipo: "erro",
            });
            resolver(false);
            return;
          }
          const atualizado = { ...item, concluido, evento: { ...evento, concluido } };
          atualizarUltimo(chave, { concluido, evento: atualizado.evento });
          if (!concluido) {
            setPendencia((p) => (p?.chave === chave ? null : p));
            if (!desfazendo) {
              avisar({ texto: `“${item.nome}” reaberto.`, chave: `concluir-${chave}` });
            }
            resolver(true);
            return;
          }
          avisar({
            texto: `“${item.nome}” concluído.`,
            chave: `concluir-${chave}`,
            acao: {
              rotulo: "Desfazer",
              executar: async () => {
                if (await alternar(atualizado, false, null, true)) {
                  devolverFoco(() => gatilhoVisivel(chave), raizRef.current);
                }
              },
            },
          });
          const pendenciaNova = r.data.pendencia;
          if (pendenciaNova) setPendencia({ chave, dados: pendenciaNova });
          // Pergunta na hora (D5): abre o painel, se a conclusão veio da linha — mas só se nenhum
          // estiver aberto; se o usuário já abriu outro item, a pergunta espera no painel deste.
          if (pendenciaNova && !abertoRef.current) {
            setAberto((a) => a ?? { chave, ultimo: atualizado, modo: "detalhes" });
            ultimaChaveRef.current = chave;
            if (gatilho) gatilhoRef.current = gatilho;
          } else if (gatilho) {
            // A linha some do dashboard: o foco não pode ficar no botão removido.
            devolverFoco(() => (gatilho.isConnected ? null : raizRef.current), null, gatilho);
          }
          resolver(true);
        });
      });
    },
    [aplicarOtimista, atualizarUltimo, avisar],
  );

  const api = useMemo<ApiPainel>(
    () => ({
      abrir,
      concluido: (chave, atual) => otimistas.get(chave) ?? atual,
      gravando: (chave) => otimistas.has(chave),
      alternarConcluido: (chave, concluido, gatilho) => {
        const item = buscar(chave);
        if (item) void alternarConcluido(item, concluido, gatilho);
      },
    }),
    [abrir, alternarConcluido, buscar, otimistas],
  );

  const item = aberto ? (atualDaLista ?? aberto.ultimo) : null;

  return (
    <ContextoPainel.Provider value={api}>
      <div ref={raizRef} tabIndex={-1} className={cn("outline-none", className)}>
        {children}
      </div>
      <Dialog
        open={aberto !== null}
        onOpenChange={(abrirAgora) => {
          if (abrirAgora) return;
          const fechar = () => setAberto(null);
          if (formularioRef.current) formularioRef.current.sair(fechar);
          else fechar();
        }}
      >
        <DialogContent
          variante="gaveta"
          data-testid="painel-evento"
          onInteractOutside={(e) => {
            // Clicar num aviso (ex.: "Desfazer") não fecha o painel.
            if ((e.target as Element | null)?.closest?.("[data-avisos]")) e.preventDefault();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            const g = gatilhoRef.current;
            const chave = ultimaChaveRef.current;
            const alvo =
              g?.isConnected && g.getClientRects().length > 0
                ? g
                : ((chave ? gatilhoVisivel(chave) : null) ?? raizRef.current);
            alvo?.focus();
          }}
        >
          {item && aberto ? (
            aberto.modo === "editar" && item.evento ? (
              <FormularioEvento
                ref={formularioRef}
                concursoId={item.concurso.id}
                evento={item.evento}
                aoConcluir={(nome) => {
                  avisar({ texto: `“${nome}” salvo.`, chave: `salvar-${item.chave}` });
                  setAberto(null);
                }}
                aoCancelar={() => setAberto((a) => (a ? { ...a, modo: "detalhes" } : a))}
              />
            ) : (
              <DetalhesPainel
                item={item}
                origem={origem}
                api={api}
                pendencia={pendencia?.chave === item.chave ? pendencia.dados : null}
                aoEditar={() => setAberto((a) => (a ? { ...a, modo: "editar" } : a))}
                aoAlterarOculto={(oculto) => atualizarUltimo(item.chave, { oculto })}
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </ContextoPainel.Provider>
  );
}

const ALTURA_TOQUE = "max-md:h-11";

function DetalhesPainel({
  item,
  origem,
  api,
  pendencia,
  aoEditar,
  aoAlterarOculto,
}: {
  item: EventoPainel;
  origem: Origem;
  api: ApiPainel;
  pendencia: PendenciaStatus | null;
  aoEditar: () => void;
  aoAlterarOculto: (oculto: boolean) => void;
}) {
  const concluido = api.concluido(item.chave, item.concluido);
  const gravando = api.gravando(item.chave);
  const { concurso } = item;
  return (
    <>
      <DialogHeader className="pr-10">
        <DialogTitle className="leading-snug">
          <NomeEvento nome={item.nome} concluido={concluido} />
        </DialogTitle>
        <DialogDescription className="flex items-center gap-1.5">
          <MarcadorConcurso cor={concurso.cor} icone={concurso.icone} rotulado />
          <span>
            {concurso.orgao} — {concurso.cargo}
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-1.5">
        <BadgeStatus status={concurso.status} />
        <BadgeSituacao situacao={concluido ? "CONCLUIDO" : item.situacao} />
        {item.oculto ? (
          <Badge variant="outline" className="text-muted-foreground">
            <EyeOff aria-hidden />
            Oculto do dashboard
          </Badge>
        ) : null}
      </div>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
        <dt>
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Data</span>
        </dt>
        <dd className="first-letter:uppercase">{formatarDataLonga(item.data)}</dd>
        {item.hora ? (
          <>
            <dt>
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">Horário</span>
            </dt>
            <dd className="tabular-nums">{item.hora}</dd>
          </>
        ) : null}
        {item.local ? (
          <>
            <dt>
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">Local</span>
            </dt>
            <dd>{item.local}</dd>
          </>
        ) : null}
      </dl>

      {pendencia && concluido ? (
        <SugestaoStatus
          key={pendencia.chave}
          concursoId={concurso.id}
          chave={pendencia.chave}
          pergunta={pendencia.pergunta}
          motivo={pendencia.motivo}
          respostas={pendencia.respostas.map(({ id, rotulo, para, confirmar }) => ({
            id,
            rotulo,
            para,
            confirmar,
          }))}
        />
      ) : null}

      {item.proximos.length > 0 ? (
        <section aria-labelledby={`proximos-${item.chave}`} className="space-y-1.5">
          <h3
            id={`proximos-${item.chave}`}
            className="font-medium text-muted-foreground text-xs uppercase"
          >
            Próximos eventos do concurso
          </h3>
          <ul className="space-y-1">
            {item.proximos.map((p) => (
              <li key={p.chave} className="flex gap-2">
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatarData(p.data).slice(0, 5)}
                  {p.hora ? ` ${p.hora}` : null}
                </span>
                <span className="min-w-0 truncate">{p.nome}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-2 border-t pt-4 md:grid-cols-2">
        {item.evento ? (
          <Button
            type="button"
            variant={concluido ? "outline" : "default"}
            className={ALTURA_TOQUE}
            disabled={gravando}
            aria-busy={gravando || undefined}
            onClick={() => api.alternarConcluido(item.chave, !concluido)}
          >
            {concluido ? <RotateCcw aria-hidden /> : <CircleCheck aria-hidden />}
            {concluido ? "Reabrir" : "Marcar como concluído"}
          </Button>
        ) : null}
        <Button asChild variant={item.evento ? "outline" : "default"} className={ALTURA_TOQUE}>
          <Link href={hrefPrazo(concurso.id, item.evento, origem)}>
            Ver no concurso
            <span className="sr-only">: {item.nome}</span>
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        {item.evento ? (
          <Button type="button" variant="outline" className={ALTURA_TOQUE} onClick={aoEditar}>
            <Pencil aria-hidden />
            Editar
            <span className="sr-only"> {item.nome}</span>
          </Button>
        ) : null}
        {item.oculto !== null ? (
          <BotaoOcultarPrazo
            chave={item.chave}
            oculto={item.oculto}
            nome={item.nome}
            aoAlterar={aoAlterarOculto}
          />
        ) : null}
      </div>
    </>
  );
}

/**
 * Botão que abre o painel do item (área principal da linha no dashboard e item do calendário).
 * Aceita os atributos de `<button>`; o conteúdo é renderizado no servidor e passado como filho.
 */
export function BotaoAbrirEvento({
  chave,
  onClick,
  ...props
}: ComponentProps<"button"> & { chave: string }) {
  const { abrir } = usePainelEvento();
  return (
    <button
      type="button"
      {...props}
      {...{ [ATRIBUTO_GATILHO]: chave }}
      aria-haspopup="dialog"
      onClick={(e) => {
        onClick?.(e);
        abrir(chave, e.currentTarget);
      }}
    />
  );
}
