import type { MetadataRoute } from "next";
import { COR_TEMA } from "@/lib/pwa";

/**
 * Web App Manifest (#66): torna o app instalável (Android/Chrome abre em tela cheia, sem a barra
 * do navegador). Servido em `/manifest.webmanifest`, liberado no proxy sem login.
 * Ícones gerados de `assets/logo.svg` por `pnpm icones`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Concursos",
    short_name: "Concursos",
    description: "Controle pessoal de concursos públicos",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // O manifest é estático e não segue o tema (#81): `theme_color` só vale até a página carregar,
    // quando a `<meta name="theme-color">` do SCRIPT_TEMA assume (claro ou escuro). Fica o claro,
    // que é o tema sem JS. `background_color` é só o fundo da tela de abertura (cor do ícone).
    background_color: COR_TEMA.fundoSplash,
    theme_color: COR_TEMA.claro,
    categories: ["productivity", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
