"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useTransition } from "react";
import { ICONE_TEMA, useTema } from "@/components/tema/seletor-tema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizarTema, ROTULO_TEMA, TEMAS } from "@/lib/tema";
import { cn } from "@/lib/utils";
import { logout } from "@/server/actions/auth";
import { alternarVisaoAcao } from "@/server/actions/visao";
import type { Visao } from "@/server/auth/visao";

export interface ContaMenu {
  nome: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface MenuContaProps {
  conta: ContaMenu;
  /** Só admins veem o seletor de visão (#50). */
  ehAdmin: boolean;
  visao: Visao;
  /** Há login configurado (mostra "Sair"). */
  podeSair: boolean;
  /**
   * Cabeçalho do celular: só o avatar, e o tema passa para dentro do menu (#78), liberando espaço
   * no cabeçalho de ~360 px. No desktop o seletor de tema fica visível na barra lateral. Na visão
   * usuário, Configurações também entra aqui (#105): na barra inferior o lugar é de Notificações.
   */
  compacto?: boolean;
  className?: string;
}

/** Claro / Escuro / Sistema dentro do menu (modo compacto). Fica aberto ao escolher. */
function ItensTema() {
  const [tema, escolher] = useTema();
  const idRotulo = useId();
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel id={idRotulo}>Tema</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        aria-labelledby={idRotulo}
        value={tema}
        onValueChange={(v) => escolher(normalizarTema(v))}
      >
        {TEMAS.map((opcao) => {
          const Icone = ICONE_TEMA[opcao];
          return (
            <DropdownMenuRadioItem
              key={opcao}
              value={opcao}
              onSelect={(evento) => evento.preventDefault()}
            >
              <Icone aria-hidden />
              {ROTULO_TEMA[opcao]}
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
    </>
  );
}

/** Iniciais do nome (ou do e-mail); `null` sem nenhum dos dois (usuário local). */
function iniciais(conta: ContaMenu): string | null {
  const partes = (conta.nome ?? conta.email ?? "").split(/[\s@.]+/).filter(Boolean);
  if (partes.length === 0) return null;
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

function Avatar({ conta }: { conta: ContaMenu }) {
  const letras = iniciais(conta);
  return conta.avatarUrl ? (
    // biome-ignore lint/performance/noImgElement: foto pequena do Google, sem otimização do Next
    <img
      src={conta.avatarUrl}
      alt=""
      width={28}
      height={28}
      referrerPolicy="no-referrer"
      className="size-7 shrink-0 rounded-full"
    />
  ) : (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs"
    >
      {letras ?? <UserRound className="size-4" aria-hidden />}
    </span>
  );
}

/**
 * Menu da conta (avatar): nome, alternância "Visão usuário" ↔ "Visão admin" (só admins, #50),
 * Configurações e tema (só no modo compacto, #105 e #78) e Sair. A troca de visão não exige novo
 * login. No desktop, Configurações fica só na navegação lateral (#82); no celular, só aqui (#105).
 */
export function MenuConta({
  conta,
  ehAdmin,
  visao,
  podeSair,
  compacto = false,
  className,
}: MenuContaProps) {
  const [pendente, iniciar] = useTransition();
  const pathname = usePathname();
  const nome = conta.nome ?? conta.email ?? "Usuário local";

  // Sem nenhuma ação (não admin, sem login e sem tema no menu), um menu vazio seria anunciado
  // sem itens: mostra só avatar e nome. O compacto sempre tem menu (tema; Configurações na visão
  // usuário).
  if (!ehAdmin && !podeSair && !compacto) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2 p-1 text-sm", className)}>
        <Avatar conta={conta} />
        <span className="truncate font-medium">{nome}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu da conta"
        disabled={pendente}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-md p-1 pointer-coarse:p-1.5 text-left text-sm outline-none hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50",
          // Só o avatar (28 px) no celular: alvo de toque de 44 px (#105).
          compacto && "pointer-coarse:p-2",
          className,
        )}
      >
        <Avatar conta={conta} />
        {compacto ? null : <span className="truncate font-medium">{nome}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-72">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{nome}</span>
          {conta.email && conta.nome ? <span className="block truncate">{conta.email}</span> : null}
        </DropdownMenuLabel>
        {ehAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={visao}
              onValueChange={(v) => {
                if (v === visao) return;
                iniciar(async () => {
                  await alternarVisaoAcao(v);
                });
              }}
            >
              <DropdownMenuRadioItem value="usuario">Visão usuário</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="admin">Visão admin</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}
        {compacto && visao === "usuario" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/configuracoes"
                aria-current={pathname === "/configuracoes" ? "page" : undefined}
              >
                <Settings aria-hidden />
                Configurações
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        {compacto ? <ItensTema /> : null}
        {podeSair ? <DropdownMenuSeparator /> : null}
        {podeSair ? (
          <DropdownMenuItem
            onSelect={() => {
              iniciar(async () => {
                await logout();
              });
            }}
          >
            <LogOut aria-hidden />
            Sair
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
