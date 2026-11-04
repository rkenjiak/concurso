import type { Metadata, Viewport } from "next";
import { SCRIPT_TEMA } from "@/lib/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Concursos",
    template: "%s · Concursos",
  },
  description: "Controle pessoal de concursos públicos",
  applicationName: "Concursos",
  // iOS: "Adicionar à Tela de Início" abre sem a interface do Safari (#66). Barra de status
  // "default" (opaca, texto escuro): a translúcida deixaria o texto branco sobre o tema claro.
  appleWebApp: {
    capable: true,
    title: "Concursos",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // `<meta name="color-scheme" content="light dark">` (#81): avisa o navegador, antes do CSS, que a
  // página tem os dois esquemas; o esquema efetivo é o `color-scheme` que o SCRIPT_TEMA põe no
  // <html>. É estática, então o Next recriá-la a cada navegação não desfaz a escolha do usuário.
  colorScheme: "light dark",
  // Sem `themeColor`: a `<meta name="theme-color">` é criada pelo SCRIPT_TEMA e segue o tema
  // efetivo, inclusive o escolhido no app (o Next recriaria a dele a cada navegação, #66).
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning`: o script de tema altera classe/estilo do <html> antes da hidratação.
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo (e a cor da barra de status) antes da primeira pintura. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script estático, sem dados do usuário */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
