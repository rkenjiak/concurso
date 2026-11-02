"use client";

import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CorConcurso } from "@/domain/cores";
import type { Status } from "@/domain/enums";
import { DESCRICAO_STATUS, ROTULO_STATUS } from "@/domain/labels";
import { type ColunaQuadro, montarQuadro } from "@/domain/quadro";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";
import { alterarStatus, desfazerUltimoStatus } from "@/server/actions/status";
import { ListaTags } from "./lista-tags";
import { MarcadorConcurso } from "./marcador-concurso";

/** Dados de um cartão do quadro (serializáveis, vindos do servidor). */
export interface CartaoQuadro {
  id: number;
  orgao: string;
  cargo: string;
  banca: string | null;
  status: Status;
  proximaData: string | null;
  tags: string[];
  /** Cor exibida (escolhida ou automática) e ícone do concurso (#46). */
  cor: CorConcurso;
  icone: string | null;
  /** Destinos permitidos a partir do status atual (regras de `domain/status`). */
  transicoes: Status[];
}

type Aviso =
  | { tipo: "ok"; texto: string; concursoId: number }
  | { tipo: "erro"; texto: string }
  | { tipo: "info"; texto: string };

const TIPO_ARRASTE = "application/x-concurso-id";

/**
 * Quadro por status (kanban). Mover um cartão — arrastando no desktop ou pelo menu "Mover para"
 * (teclado/celular) — chama a mesma Server Action da troca de status do detalhe: a transição é
 * validada no servidor, o histórico é gravado e a última mudança pode ser desfeita.
 */
export function QuadroConcursos({ cartoes }: { cartoes: CartaoQuadro[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [arrastando, setArrastando] = useState<CartaoQuadro | null>(null);
  const [agrupadasAbertas, setAgrupadasAbertas] = useState(false);
  const [otimistas, moverOtimista] = useOptimistic(
    cartoes,
    (atual, { id, para }: { id: number; para: Status }) =>
      atual.map((c) => (c.id === id ? { ...c, status: para, transicoes: [] } : c)),
  );
  const quadro = montarQuadro(otimistas);

  function mover(cartao: CartaoQuadro, para: Status) {
    if (cartao.status === para) return;
    setAviso(null);
    iniciar(async () => {
      moverOtimista({ id: cartao.id, para });
      const r = await alterarStatus(cartao.id, { para });
      if (r.ok) {
        setAviso({
          tipo: "ok",
          texto: `“${cartao.orgao}” movido para “${ROTULO_STATUS[para]}”.`,
          concursoId: cartao.id,
        });
      } else {
        setAviso({ tipo: "erro", texto: r.erros._form?.[0] ?? "Não foi possível mover." });
        // Falhou: nada foi revalidado; busca o estado atual (outra aba pode ter mudado o status).
        router.refresh();
      }
    });
  }

  function desfazer(concursoId: number) {
    setAviso(null);
    iniciar(async () => {
      const r = await desfazerUltimoStatus(concursoId);
      setAviso(
        r.ok
          ? {
              tipo: "info",
              texto: `Mudança desfeita: de volta a “${ROTULO_STATUS[r.data.status]}”.`,
            }
          : { tipo: "erro", texto: r.erros._form?.[0] ?? "Não foi possível desfazer." },
      );
      if (!r.ok) router.refresh();
    });
  }

  function soltar(e: DragEvent, para: Status) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData(TIPO_ARRASTE));
    setArrastando(null);
    const cartao = otimistas.find((c) => c.id === id);
    if (cartao) mover(cartao, para);
  }

  const propsColuna = (status: Status) => ({
    status,
    arrastando,
    aoSoltar: soltar,
    aoArrastar: setArrastando,
    aoMover: mover,
    pendente,
  });

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="min-h-8">
        {aviso ? (
          <div
            role={aviso.tipo === "erro" ? "alert" : "status"}
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
              aviso.tipo === "erro" && "border-destructive/40 text-destructive",
            )}
          >
            <span>{aviso.texto}</span>
            {aviso.tipo === "ok" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pendente}
                onClick={() => desfazer(aviso.concursoId)}
              >
                <Undo2 aria-hidden />
                Desfazer
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="py-1.5 text-muted-foreground text-xs">
            Arraste os cartões entre as colunas ou use “Mover para” em cada cartão.
          </p>
        )}
      </div>

      <div
        className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
        aria-busy={pendente}
      >
        {quadro.principais.map((coluna) => (
          <Coluna key={coluna.status} coluna={coluna} {...propsColuna(coluna.status)} />
        ))}

        <section
          aria-label="Encerrados e suspensos"
          className={cn(
            "flex shrink-0 snap-start flex-col gap-2 rounded-xl border bg-muted/40 p-2",
            agrupadasAbertas ? "w-72" : "w-14",
          )}
          onDragEnter={() => setAgrupadasAbertas(true)}
        >
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={agrupadasAbertas}
            aria-label={`Encerrados e suspensos (${quadro.totalAgrupadas})`}
            onClick={() => setAgrupadasAbertas((v) => !v)}
            className={cn("justify-between", !agrupadasAbertas && "h-auto flex-col py-2")}
          >
            {agrupadasAbertas ? (
              <>
                <span>Encerrados e suspensos ({quadro.totalAgrupadas})</span>
                <ChevronLeft aria-hidden />
              </>
            ) : (
              <>
                <ChevronRight aria-hidden />
                <span className="[writing-mode:vertical-rl]">
                  Encerrados e suspensos ({quadro.totalAgrupadas})
                </span>
              </>
            )}
          </Button>
          {agrupadasAbertas
            ? quadro.agrupadas.map((coluna) => (
                <Coluna
                  key={coluna.status}
                  coluna={coluna}
                  aninhada
                  {...propsColuna(coluna.status)}
                />
              ))
            : null}
        </section>
      </div>
    </div>
  );
}

interface ColunaProps {
  coluna: ColunaQuadro<CartaoQuadro>;
  status: Status;
  aninhada?: boolean;
  arrastando: CartaoQuadro | null;
  pendente: boolean;
  aoSoltar: (e: DragEvent, para: Status) => void;
  aoArrastar: (cartao: CartaoQuadro | null) => void;
  aoMover: (cartao: CartaoQuadro, para: Status) => void;
}

function Coluna({
  coluna,
  status,
  aninhada = false,
  arrastando,
  pendente,
  aoSoltar,
  aoArrastar,
  aoMover,
}: ColunaProps) {
  const [sobre, setSobre] = useState(false);
  const idTitulo = `coluna-${status}`;
  const permitido = arrastando ? arrastando.transicoes.includes(status) : false;
  const origem = arrastando?.status === status;

  return (
    <section
      aria-labelledby={idTitulo}
      data-status={status}
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-2 transition-colors",
        aninhada ? "bg-background" : "w-72 shrink-0 snap-start bg-muted/40",
        arrastando && !origem && (permitido ? "border-primary border-dashed" : "opacity-60"),
        sobre && permitido && "bg-primary/10",
      )}
      onDragOver={(e) => {
        if (!arrastando || origem) return;
        // Aceita soltar em qualquer coluna: a transição é validada no servidor, que devolve a
        // mensagem do domínio quando não é permitida.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        setSobre(false);
        aoSoltar(e, status);
      }}
    >
      <h2
        id={idTitulo}
        className="flex items-center justify-between gap-2 px-1 font-medium text-sm"
        title={DESCRICAO_STATUS[status]}
      >
        <span>{ROTULO_STATUS[status]}</span>
        <span className="text-muted-foreground text-xs tabular-nums">{coluna.itens.length}</span>
      </h2>
      <ul className={cn("flex flex-col gap-2", !aninhada && "min-h-24")}>
        {coluna.itens.map((cartao) => (
          <Cartao
            key={cartao.id}
            cartao={cartao}
            pendente={pendente}
            aoArrastar={aoArrastar}
            aoMover={aoMover}
          />
        ))}
      </ul>
    </section>
  );
}

function Cartao({
  cartao,
  pendente,
  aoArrastar,
  aoMover,
}: {
  cartao: CartaoQuadro;
  pendente: boolean;
  aoArrastar: (cartao: CartaoQuadro | null) => void;
  aoMover: (cartao: CartaoQuadro, para: Status) => void;
}) {
  const idMover = `mover-${cartao.id}`;
  return (
    <li
      draggable={!pendente}
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO_ARRASTE, String(cartao.id));
        e.dataTransfer.effectAllowed = "move";
        aoArrastar(cartao);
      }}
      onDragEnd={() => aoArrastar(null)}
      aria-label={`${cartao.orgao} — ${cartao.cargo}`}
      className="cursor-grab space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs active:cursor-grabbing"
    >
      <div className="flex items-start gap-1">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <Link
            href={`/concursos/${cartao.id}`}
            draggable={false}
            className="flex items-center gap-1.5 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <MarcadorConcurso cor={cartao.cor} icone={cartao.icone} />
            <span className="min-w-0 truncate">{cartao.orgao}</span>
          </Link>
          <p className="truncate text-muted-foreground">{cartao.cargo}</p>
          {cartao.banca ? (
            <p className="truncate text-muted-foreground text-xs">{cartao.banca}</p>
          ) : null}
        </div>
      </div>
      {cartao.proximaData ? (
        <p className="inline-flex items-center gap-1 text-muted-foreground text-xs">
          <CalendarDays className="size-3.5" aria-hidden />
          Próxima data: {formatarData(cartao.proximaData)}
        </p>
      ) : null}
      <ListaTags tags={cartao.tags} />
      {cartao.transicoes.length > 0 ? (
        <NativeSelect
          id={idMover}
          size="sm"
          className="w-full"
          aria-label={`Mover “${cartao.orgao}” para`}
          value=""
          disabled={pendente}
          onChange={(e) => {
            const para = e.target.value as Status | "";
            if (para) aoMover(cartao, para);
          }}
        >
          <NativeSelectOption value="">Mover para…</NativeSelectOption>
          {cartao.transicoes.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {ROTULO_STATUS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
    </li>
  );
}
