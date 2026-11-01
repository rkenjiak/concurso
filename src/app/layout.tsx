import type { Metadata, Viewport } from "next";
import { SCRIPT_TEMA } from "@/lib/tema";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning`: o script de tema altera classe/estilo do <html> antes da hidratação.
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura (sem flash). */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script estático, sem dados do usuário */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
