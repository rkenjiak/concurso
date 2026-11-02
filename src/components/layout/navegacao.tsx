"use client";

import {
  CalendarDays,
  ClipboardList,
  Gauge,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** Ativo só no caminho exato (não nos subcaminhos). */
  exato?: boolean;
}

export const ITENS_NAVEGACAO: readonly ItemNavegacao[] = [
  { href: "/", rotulo: "Dashboard", icone: LayoutDashboard, exato: true },
  { href: "/concursos", rotulo: "Concursos", icone: ClipboardList },
  { href: "/calendario", rotulo: "Calendário", icone: CalendarDays },
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

/** Navegação da visão admin (#50). */
export const ITENS_NAVEGACAO_ADMIN: readonly ItemNavegacao[] = [
  { href: "/admin", rotulo: "Visão geral", icone: Gauge, exato: true },
  { href: "/admin/usuarios", rotulo: "Usuários", icone: Users },
  { href: "/admin/acesso", rotulo: "Acesso", icone: KeyRound },
  { href: "/admin/auditoria", rotulo: "Auditoria", icone: ScrollText },
];

type Secao = "app" | "admin";
const ITENS: Record<Secao, readonly ItemNavegacao[]> = {
  app: ITENS_NAVEGACAO,
  admin: ITENS_NAVEGACAO_ADMIN,
};
const ROTULO: Record<Secao, string> = {
  app: "Navegação principal",
  admin: "Navegação do painel admin",
};

function estaAtivo(pathname: string, { href, exato }: ItemNavegacao): boolean {
  return exato ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegação lateral (desktop, a partir de `md`). */
export function NavegacaoLateral({ secao = "app" }: { secao?: Secao }) {
  const pathname = usePathname();
  return (
    <nav aria-label={ROTULO[secao]} className="flex flex-col gap-1">
      {ITENS[secao].map((item) => {
        const { href, rotulo, icone: Icone } = item;
        const ativo = estaAtivo(pathname, item);
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
export function NavegacaoInferior({ secao = "app" }: { secao?: Secao }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={ROTULO[secao]}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITENS[secao].map((item) => {
          const { href, rotulo, icone: Icone } = item;
          const ativo = estaAtivo(pathname, item);
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
