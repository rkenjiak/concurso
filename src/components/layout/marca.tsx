import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Ícone + nome do app, com link para o dashboard. `nomeClassName` permite esconder o nome
 * visualmente (ex.: `max-[399px]:sr-only` no cabeçalho do celular com selo), sem perdê-lo para
 * leitores de tela.
 */
export function Marca({ nomeClassName }: { nomeClassName?: string }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
      {/* biome-ignore lint/performance/noImgElement: ícone SVG estático, não precisa de otimização */}
      <img src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
      <span className={cn(nomeClassName)}>Concursos</span>
    </Link>
  );
}
