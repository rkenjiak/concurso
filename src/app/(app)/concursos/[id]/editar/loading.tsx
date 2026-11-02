import { EsqueletoPagina } from "@/components/layout/esqueleto";

/** Fallback da edição (#73): sem isto, valeria o esqueleto do detalhe, de forma bem diferente. */
export default function Carregando() {
  return <EsqueletoPagina cards={2} />;
}
