import type { ReactNode } from "react";
import { Marca } from "@/components/layout/marca";
import { type ContaMenu, MenuConta } from "@/components/layout/menu-conta";
import { NavegacaoInferior, NavegacaoLateral } from "@/components/layout/navegacao";
import { SeletorTema } from "@/components/tema/seletor-tema";
import type { Visao } from "@/server/auth/visao";

interface CascaProps {
  /** Visão exibida: decide a navegação ("usuario" = app comum; "admin" = painel, #50). */
  visao: Visao;
  conta: ContaMenu;
  ehAdmin: boolean;
  podeSair: boolean;
  /** Faixa no topo do conteúdo (ex.: "Modo admin"). */
  faixa?: ReactNode;
  /** Selo ao lado da marca. */
  selo?: ReactNode;
  children: ReactNode;
}

/** Estrutura das páginas: navegação lateral (desktop) e inferior (celular) e menu da conta. */
export function Casca({ visao, conta, ehAdmin, podeSair, faixa, selo, children }: CascaProps) {
  const secao = visao === "admin" ? "admin" : "app";
  const menu = { conta, ehAdmin, visao, podeSair };
  return (
    <>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 text-sidebar-foreground md:flex">
          <div className="flex items-center gap-2">
            <Marca />
            {selo}
          </div>
          <NavegacaoLateral secao={secao} />
          <div className="mt-auto flex flex-col gap-3">
            <MenuConta {...menu} />
            <SeletorTema className="self-start" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden">
            <Marca />
            {selo}
            <SeletorTema className="ml-auto" />
            <MenuConta {...menu} compacto />
          </header>
          {faixa}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
            {children}
          </main>
        </div>
      </div>
      <NavegacaoInferior secao={secao} />
    </>
  );
}
