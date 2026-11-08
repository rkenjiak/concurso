"use client";

import { cn } from "cn";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { RegiaoAvisos } from "@/components/avisos/avisos";
import { Button } from "@/components/ui/button";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 dark:bg-black/60 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Posição do conteúdo: `centro` (padrão) ou `gaveta` — painel de baixo (largura total, cantos
 * superiores arredondados, área segura) abaixo de `md` e diálogo centralizado a partir de `md`
 * (#100, D3). Sem alça de arrastar: fecha pelo X, Esc ou clique fora.
 *
 * Centraliza com `inset-0 m-auto h-fit`, não com `translate`: um `transform` no conteúdo faria a
 * {@link RegiaoAvisos} (`fixed`) se posicionar relativa ao diálogo em vez da viewport.
 */
const POSICAO_CONTEUDO = {
  centro:
    "inset-0 m-auto h-fit w-full max-w-[calc(100%-2rem)] rounded-xl p-4 duration-100 sm:max-w-sm data-open:zoom-in-95 data-closed:zoom-out-95",
  gaveta:
    "inset-x-0 bottom-0 max-h-[85dvh] w-full overflow-y-auto rounded-t-xl pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] duration-200 max-md:motion-safe:data-open:slide-in-from-bottom max-md:motion-safe:data-closed:slide-out-to-bottom md:inset-0 md:m-auto md:h-fit md:max-h-[90dvh] md:max-w-lg md:rounded-xl md:p-4 md:duration-100 md:data-open:zoom-in-95 md:data-closed:zoom-out-95",
} as const;

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variante = "centro",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  variante?: keyof typeof POSICAO_CONTEUDO;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-variante={variante}
        className={cn(
          "fixed z-50 grid gap-4 bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          POSICAO_CONTEUDO[variante],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className={cn(
                "absolute top-2 right-2",
                variante === "gaveta" && "max-md:size-11 max-md:pointer-coarse:size-11",
              )}
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Fechar</span>
            </Button>
          </DialogPrimitive.Close>
        )}
        {/* Avisos dentro do diálogo: fora dele ficariam `aria-hidden` e fora do focus trap. */}
        <RegiaoAvisos />
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Fechar</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
