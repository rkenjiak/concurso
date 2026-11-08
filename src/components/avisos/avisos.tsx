"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  type Aviso,
  adicionar,
  agendarVencimento,
  definirPausa,
  ESTADO_INICIAL,
  type EstadoAvisos,
  expirar,
  type NovoAviso,
  remover,
  visiveis,
} from "@/lib/avisos";
import { cn } from "@/lib/utils";

export type { AcaoAviso, NovoAviso, TipoAviso } from "@/lib/avisos";

interface ApiAvisos {
  /** Mostra um aviso e devolve o id (para {@link ApiAvisos.fechar}). */
  avisar: (aviso: NovoAviso) => number;
  /** Fecha um aviso antes do tempo (id inexistente é ignorado). */
  fechar: (id: number) => void;
}

const ContextoAvisos = createContext<ApiAvisos | null>(null);

/** Registra o contêiner de uma {@link RegiaoAvisos}; devolve o cancelamento do registro. */
type RegistrarRegiao = (el: HTMLElement) => () => void;
const ContextoRegioes = createContext<RegistrarRegiao | null>(null);

/** Posição da pilha (fixa na viewport) e atributos comuns às regiões de avisos. */
const PROPS_REGIAO = {
  // `data-avisos`: o foco "perdido" num aviso que fechou volta ao item (painel de evento).
  "data-avisos": "",
  "aria-live": "polite",
  "aria-relevant": "additions text",
  className:
    "pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:inset-x-auto md:right-6 md:bottom-6 md:p-0",
} as const;

type Acao =
  | { tipo: "adicionar"; aviso: NovoAviso; id: number; agora: number }
  | { tipo: "remover"; id: number; agora: number }
  | { tipo: "pausa"; id: number; pausado: boolean; agora: number }
  | { tipo: "expirar"; agora: number };

function reduzir(estado: EstadoAvisos, acao: Acao): EstadoAvisos {
  switch (acao.tipo) {
    case "adicionar":
      // O id é reservado fora do reducer para `avisar` poder devolvê-lo de forma síncrona.
      return adicionar({ ...estado, proximoId: acao.id }, acao.aviso, acao.agora).estado;
    case "remover":
      return remover(estado, acao.id, acao.agora);
    case "pausa":
      return definirPausa(estado, acao.id, acao.pausado, acao.agora);
    case "expirar":
      return expirar(estado, acao.agora);
  }
}

let ultimoId = 0;

/**
 * Avisos (toasts) do app (#100, D4), montado na {@link Casca}: vale para todas as telas, inclusive
 * as que são Server Components — quem avisa é um componente cliente com {@link useAvisos}, em
 * geral depois de aguardar uma Server Action.
 *
 * A pilha fica no canto inferior direito no desktop e, no celular, logo acima da barra de
 * navegação inferior (`NavegacaoInferior`, ~57 px + área segura). É uma região `aria-live` polite;
 * erros usam `role="alert"`. Hover ou foco num aviso pausa a contagem dele; Esc fecha.
 *
 * Com um diálogo modal aberto, o Radix esconde o resto da página (`aria-hidden`) e prende o foco
 * nele: os avisos então são renderizados na {@link RegiaoAvisos} do diálogo mais recente — assim
 * são anunciados e o "Desfazer" é alcançável pelo Tab.
 */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(reduzir, ESTADO_INICIAL);
  const [regioes, setRegioes] = useState<readonly HTMLElement[]>([]);

  useEffect(
    () => agendarVencimento(estado, (agora) => despachar({ tipo: "expirar", agora })),
    [estado],
  );

  const registrarRegiao = useCallback<RegistrarRegiao>((el) => {
    setRegioes((r) => [...r, el]);
    return () => setRegioes((r) => r.filter((x) => x !== el));
  }, []);
  const regiaoDialogo = regioes.at(-1);

  const avisar = useCallback((aviso: NovoAviso) => {
    ultimoId += 1;
    despachar({ tipo: "adicionar", aviso, id: ultimoId, agora: Date.now() });
    return ultimoId;
  }, []);
  const fechar = useCallback(
    (id: number) => despachar({ tipo: "remover", id, agora: Date.now() }),
    [],
  );
  const pausar = useCallback(
    (id: number, pausado: boolean) => despachar({ tipo: "pausa", id, pausado, agora: Date.now() }),
    [],
  );
  const api = useMemo(() => ({ avisar, fechar }), [avisar, fechar]);

  const lista = (
    <ol className="flex w-full max-w-sm flex-col gap-2">
      {visiveis(estado).map((aviso) => (
        <ItemAviso
          key={aviso.id}
          aviso={aviso}
          aoFechar={fechar}
          aoPausar={pausar}
          avisar={avisar}
        />
      ))}
    </ol>
  );

  return (
    <ContextoAvisos.Provider value={api}>
      <ContextoRegioes.Provider value={registrarRegiao}>{children}</ContextoRegioes.Provider>
      {/* A região existe desde o início (senão leitores de tela ignoram o 1º aviso). */}
      <div {...PROPS_REGIAO}>{regiaoDialogo ? null : lista}</div>
      {regiaoDialogo ? createPortal(lista, regiaoDialogo) : null}
    </ContextoAvisos.Provider>
  );
}

/**
 * Região de avisos dentro de um diálogo modal (renderizada pelo `DialogContent` e pelo
 * `AlertDialogContent`): fica dentro da árvore acessível e do focus trap do diálogo. Vazia ao
 * montar, como a região global, para os avisos seguintes serem anunciados. O diálogo não pode ter
 * `transform` (a posição `fixed` passaria a ser relativa a ele). Fora do provider, não renderiza.
 */
export function RegiaoAvisos() {
  const registrar = useContext(ContextoRegioes);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!registrar || !ref.current) return;
    return registrar(ref.current);
  }, [registrar]);
  return registrar ? <div ref={ref} {...PROPS_REGIAO} /> : null;
}

/**
 * Mostra avisos a partir de componentes cliente:
 * `const { avisar } = useAvisos(); avisar({ texto, tipo: "ok" | "erro" | "info", acao?, duracaoMs?, chave? })`.
 */
export function useAvisos(): ApiAvisos {
  const api = useContext(ContextoAvisos);
  if (!api) throw new Error("useAvisos precisa estar dentro de <AvisosProvider>.");
  return api;
}

const ICONE = { ok: CircleCheck, erro: CircleAlert, info: Info } as const;

function ItemAviso({
  aviso,
  aoFechar,
  aoPausar,
  avisar,
}: {
  aviso: Aviso;
  aoFechar: (id: number) => void;
  aoPausar: (id: number, pausado: boolean) => void;
  avisar: (aviso: NovoAviso) => number;
}) {
  const [sobre, setSobre] = useState(false);
  const [focado, setFocado] = useState(false);
  const [pendente, setPendente] = useState(false);
  const pausado = sobre || focado || pendente;
  const { id, acao, tipo } = aviso;
  const Icone = ICONE[tipo];

  useEffect(() => {
    aoPausar(id, pausado);
  }, [aoPausar, id, pausado]);

  async function executar() {
    if (!acao || pendente) return;
    setPendente(true);
    try {
      await acao.executar();
    } catch {
      avisar({ texto: "Não foi possível concluir a ação.", tipo: "erro" });
    } finally {
      aoFechar(id);
    }
  }

  return (
    <li
      role={tipo === "erro" ? "alert" : undefined}
      data-tipo={tipo}
      className={cn(
        "pointer-events-auto flex items-start gap-2 rounded-lg border bg-popover p-3 text-popover-foreground text-sm shadow-lg",
        "motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:animate-in motion-safe:duration-200",
        tipo === "erro" && "border-destructive/50",
      )}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
      onFocus={() => setFocado(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocado(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") aoFechar(id);
      }}
    >
      <Icone
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tipo === "erro"
            ? "text-destructive"
            : tipo === "ok"
              ? "text-primary"
              : "text-muted-foreground",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 basis-40 py-0.5">{aviso.texto}</p>
        {acao ? (
          <Button
            variant="outline"
            size="sm"
            aria-disabled={pendente || undefined}
            aria-busy={pendente || undefined}
            onClick={executar}
          >
            {pendente ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : null}
            {acao.rotulo}
          </Button>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Fechar aviso"
        className="-mt-0.5 -mr-1 text-muted-foreground"
        onClick={() => aoFechar(id)}
      >
        <X aria-hidden />
      </Button>
    </li>
  );
}
