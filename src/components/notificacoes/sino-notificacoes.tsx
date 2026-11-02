import { Bell, BellDot } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Texto do contador: até 99, depois "99+". */
export function textoContador(naoLidas: number): string {
  return naoLidas > 99 ? "99+" : String(naoLidas);
}

/** Rótulo acessível do sino. */
export function rotuloSino(naoLidas: number): string {
  if (naoLidas === 0) return "Notificações (nenhuma não lida)";
  return `Notificações (${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"})`;
}

/**
 * Sino da central de notificações (#65): leva a `/notificacoes`, com o contador de não lidas.
 * Aparece na navegação (lateral no desktop, cabeçalho no celular) e no dashboard.
 */
export function SinoNotificacoes({
  naoLidas,
  className,
}: {
  naoLidas: number;
  className?: string;
}) {
  const Icone = naoLidas > 0 ? BellDot : Bell;
  return (
    <Link
      href="/notificacoes"
      aria-label={rotuloSino(naoLidas)}
      title="Notificações"
      data-testid="sino-notificacoes"
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:size-10",
        className,
      )}
    >
      <Icone className="size-5" aria-hidden />
      {naoLidas > 0 ? (
        <span
          aria-hidden
          data-testid="contador-notificacoes"
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-[0.625rem] text-white tabular-nums leading-none"
        >
          {textoContador(naoLidas)}
        </span>
      ) : null}
    </Link>
  );
}
