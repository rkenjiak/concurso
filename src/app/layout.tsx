import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { NavegacaoInferior, NavegacaoLateral } from "@/components/layout/navegacao";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Concursos",
    template: "%s · Concursos",
  },
  description: "Controle pessoal de concursos públicos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      {/* biome-ignore lint/performance/noImgElement: ícone SVG estático, não precisa de otimização */}
      <img src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
      <span>Concursos</span>
    </Link>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-background font-sans text-foreground">
        <div className="flex min-h-dvh">
          <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 text-sidebar-foreground md:flex">
            <Marca />
            <NavegacaoLateral />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur md:hidden">
              <Marca />
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
              {children}
            </main>
          </div>
        </div>
        <NavegacaoInferior />
      </body>
    </html>
  );
}
