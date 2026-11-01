"use client";

import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ItemNavegacao {
  href: "/" | "/concursos" | "/calendario" | "/configuracoes";
  rotulo: string;
  icone: LucideIcon;
}

export const ITENS_NAVEGACAO: readonly ItemNavegacao[] = [
  { href: "/", rotulo: "Dashboard", icone: LayoutDashboard },
  { href: "/concursos", rotulo: "Concursos", icone: ClipboardList },
  { href: "/calendario", rotulo: "Calendário", icone: CalendarDays },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

function estaAtivo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegação lateral (desktop, a partir de `md`). */
export function NavegacaoLateral() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {ITENS_NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
        const ativo = estaAtivo(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
              ativo
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icone className="size-4" aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra de navegação inferior (celular, abaixo de `md`). */
export function NavegacaoInferior() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITENS_NAVEGACAO.map(({ href, rotulo, icone: Icone }) => {
          const ativo = estaAtivo(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 font-medium text-xs transition-colors",
                  ativo ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icone className="size-5" aria-hidden />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
