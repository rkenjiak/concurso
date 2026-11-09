import { Bell, BellDot } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CLASSE_SELO_NOTIFICACOES,
  rotuloNotificacoes,
  textoContadorNotificacoes,
} from "./contador-notificacoes";

/**
 * Sino da central de notificações (#65): leva a `/notificacoes`, com o contador de não lidas.
 * Fica só na barra lateral do desktop; no celular a entrada é o item Notificações da barra
 * inferior (#105). Um único ponto de entrada por layout (#78).
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
      aria-label={rotuloNotificacoes(naoLidas)}
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
          className={cn(CLASSE_SELO_NOTIFICACOES, "-top-0.5 -right-0.5")}
        >
          {textoContadorNotificacoes(naoLidas)}
        </span>
      ) : null}
    </Link>
  );
}
