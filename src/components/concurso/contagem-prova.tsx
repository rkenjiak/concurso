import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import type { Contagem, DestaqueContagem } from "@/domain/contagem";
import type { CorConcurso } from "@/domain/cores";
import { nomeEvento } from "@/domain/eventos-chave";
import { formatarData } from "@/lib/format";
import { cn } from "@/lib/utils";

const ESTILO_DESTAQUE: Readonly<Record<DestaqueContagem, string>> = {
  HOJE: "border-destructive bg-destructive/10 text-destructive",
  AMANHA: "border-destructive/60 bg-destructive/5 text-destructive",
  PROXIMA: "border-aviso bg-aviso/10 text-aviso-foreground",
  NORMAL: "border-border text-foreground",
};

/** Número grande + legenda ("12 dias", "hoje", "amanhã"). */
function Numero({ contagem }: { contagem: Contagem }) {
  if (contagem.destaque === "HOJE") return <span className="font-semibold">Hoje</span>;
  if (contagem.destaque === "AMANHA") return <span className="font-semibold">Amanhã</span>;
  return (
    <span>
      <span className="font-semibold tabular-nums">{contagem.dias}</span> dias
    </span>
  );
}

/**
 * Contagem regressiva até a próxima prova do concurso (#84), para a página do concurso. O texto
 * acessível ("Prova objetiva em 12 dias, 14/11/2026") vai num trecho `sr-only`: `aria-label` em
 * elemento estático nem sempre é lido.
 */
export function ContagemProva({ contagem, className }: { contagem: Contagem; className?: string }) {
  return (
    <p
      role="note"
      data-testid="contagem-prova"
      data-destaque={contagem.destaque}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        ESTILO_DESTAQUE[contagem.destaque],
        className,
      )}
    >
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{contagem.rotulo}</span>
      <span aria-hidden>
        {nomeEvento(contagem.evento)}: {contagem.texto} ·{" "}
        <span className="tabular-nums">{formatarData(contagem.evento.data)}</span>
        {contagem.evento.hora ? ` às ${contagem.evento.hora}` : null}
      </span>
    </p>
  );
}

export interface ItemContagem {
  concursoId: number;
  orgao: string;
  cargo: string;
  cor: CorConcurso;
  icone: string | null;
  contagem: Contagem;
}

/** Lista das próximas provas no dashboard (#84), da mais próxima para a mais distante. */
export function ListaContagens({ itens }: { itens: readonly ItemContagem[] }) {
  return (
    <ul className="space-y-2" data-testid="lista-contagens">
      {itens.map((c) => (
        <li key={c.concursoId}>
          <Link
            href={`/concursos/${c.concursoId}`}
            data-destaque={c.contagem.destaque}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring",
              c.contagem.destaque !== "NORMAL" && ESTILO_DESTAQUE[c.contagem.destaque],
            )}
          >
            {/* Nome acessível = texto visível + complemento (WCAG 2.5.3, comando de voz). */}
            <div className="w-16 shrink-0 text-center text-sm leading-tight">
              <Numero contagem={c.contagem} />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 text-foreground">
              <p className="flex items-center gap-1.5 truncate font-medium text-sm">
                <MarcadorConcurso cor={c.cor} icone={c.icone} tamanho="sm" />
                <span className="truncate">{c.orgao}</span>
              </p>
              <span className="sr-only">
                {c.cargo}. {c.contagem.rotulo}.
              </span>
              <p className="truncate text-muted-foreground text-xs">
                {nomeEvento(c.contagem.evento)} · {formatarData(c.contagem.evento.data)}
                {c.contagem.evento.hora ? ` às ${c.contagem.evento.hora}` : null}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
