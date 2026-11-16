"use client";

import Link, { useLinkStatus } from "next/link";
import { type ComponentProps, useState } from "react";
import { cn } from "@/lib/utils";

/** As props do `<Link>`, menos `prefetch`: quem decide quando pré-carregar é o componente. */
export type LinkSobDemandaProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/**
 * `<Link>` que só pré-carrega por intenção (#124): passar o mouse, focar ou tocar. Para listas
 * longas (prazos, contagens, notificações, concursos), onde o prefetch padrão buscaria cada link
 * que aparece na tela, inclusive depois de cada mutação. É o `HoverPrefetchLink` da documentação
 * do Next: `prefetch={false}` até a intenção, depois `null` (o padrão). O menu e os demais links
 * continuam com o `<Link>` comum.
 *
 * Repassa o resto das props (e o `ref`) ao `<Link>` e chama os `onMouseEnter`, `onFocus` e
 * `onTouchStart` de quem usa antes de ativar. As props são serializáveis: Server Components podem
 * usá-lo direto.
 *
 * No celular o toque vem pouco antes do clique, e a navegação quase sempre sai sem prefetch: o
 * {@link IndicadorPendente} mostra que o clique foi recebido enquanto o servidor responde.
 */
export function LinkSobDemanda({
  onMouseEnter,
  onFocus,
  onTouchStart,
  className,
  children,
  ...props
}: LinkSobDemandaProps) {
  const [ativo, setAtivo] = useState(false);
  return (
    <Link
      {...props}
      prefetch={ativo ? null : false}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        setAtivo(true);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        setAtivo(true);
      }}
      onTouchStart={(e) => {
        onTouchStart?.(e);
        setAtivo(true);
      }}
      className={cn("relative", className)}
    >
      {/* Primeiro filho: absoluto, não entra no fluxo nem muda o último filho (`space-y-*`). */}
      <IndicadorPendente />
      {children}
    </Link>
  );
}

/**
 * Barra fina na base do link enquanto a navegação dele espera o servidor (`useLinkStatus`). Só
 * aparece depois de 150 ms, para não piscar em navegações rápidas (com prefetch pronto o Next nem
 * marca pendente). Decorativa (`aria-hidden`): o destino anuncia a nova página.
 */
function IndicadorPendente() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-slot="link-pendente"
      data-pendente={pending || undefined}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 m-0 h-0.5 rounded-full bg-primary opacity-0 transition-opacity",
        pending && "opacity-100 delay-150 duration-200",
      )}
    />
  );
}
