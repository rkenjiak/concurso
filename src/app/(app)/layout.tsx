import type { ReactNode } from "react";
import { Marca } from "@/components/layout/marca";
import { NavegacaoInferior, NavegacaoLateral } from "@/components/layout/navegacao";
import { SeletorTema } from "@/components/tema/seletor-tema";

/** Layout das páginas do app: navegação lateral (desktop) e inferior (celular). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 text-sidebar-foreground md:flex">
          <Marca />
          <NavegacaoLateral />
          <SeletorTema className="mt-auto self-start" />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur md:hidden">
            <Marca />
            <SeletorTema className="ml-auto" />
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
            {children}
          </main>
        </div>
      </div>
      <NavegacaoInferior />
    </>
  );
}
