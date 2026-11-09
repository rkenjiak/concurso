"use client";

import {
  Bell,
  BellDot,
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
import {
  CLASSE_SELO_NOTIFICACOES,
  rotuloNotificacoes,
  textoContadorNotificacoes,
} from "@/components/notificacoes/contador-notificacoes";
import { cn } from "@/lib/utils";

interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  /** Ativo só no caminho exato (não nos subcaminhos). */
  exato?: boolean;
  /** Entrada da central de notificações: mostra o contador de não lidas (#105). */
  notificacoes?: boolean;
}

const DASHBOARD: ItemNavegacao = {
  href: "/",
  rotulo: "Dashboard",
  icone: LayoutDashboard,
  exato: true,
};
const CONCURSOS: ItemNavegacao = { href: "/concursos", rotulo: "Concursos", icone: ClipboardList };
const CALENDARIO: ItemNavegacao = {
  href: "/calendario",
  rotulo: "Calendário",
  icone: CalendarDays,
};

/** Barra lateral (desktop): Configurações aqui; as notificações ficam no sino ao lado da marca. */
export const ITENS_NAVEGACAO: readonly ItemNavegacao[] = [
  DASHBOARD,
  CONCURSOS,
  CALENDARIO,
  { href: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

/**
 * Barra inferior (celular, #105): Notificações, de uso frequente, no lugar de Configurações, que
 * passa para o menu da conta. Substitui o sino do cabeçalho (um só ponto de entrada, #78).
 */
export const ITENS_NAVEGACAO_INFERIOR: readonly ItemNavegacao[] = [
  DASHBOARD,
  CONCURSOS,
  CALENDARIO,
  { href: "/notificacoes", rotulo: "Notificações", icone: Bell, notificacoes: true },
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
const ITENS_INFERIOR: Record<Secao, readonly ItemNavegacao[]> = {
  app: ITENS_NAVEGACAO_INFERIOR,
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
export function NavegacaoInferior({
  secao = "app",
  naoLidas = 0,
}: {
  secao?: Secao;
  /** Contador do item Notificações (#105). */
  naoLidas?: number;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={ROTULO[secao]}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITENS_INFERIOR[secao].map((item) => {
          const { href, rotulo, notificacoes } = item;
          const ativo = estaAtivo(pathname, item);
          const Icone = notificacoes && naoLidas > 0 ? BellDot : item.icone;
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                // O nome acessível diz o número real (o selo pode mostrar "99+") e começa pelo
                // rótulo visível.
                aria-label={notificacoes ? rotuloNotificacoes(naoLidas) : undefined}
                data-testid={notificacoes ? "nav-notificacoes" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-2 font-medium text-xs transition-colors",
                  ativo ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icone className="size-5" aria-hidden />
                  {notificacoes && naoLidas > 0 ? (
                    <span
                      aria-hidden
                      data-testid="contador-notificacoes"
                      className={cn(CLASSE_SELO_NOTIFICACOES, "-top-1.5 left-3")}
                    >
                      {textoContadorNotificacoes(naoLidas)}
                    </span>
                  ) : null}
                </span>
                <span className="whitespace-nowrap">{rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
