import Link from "next/link";

/** Ícone + nome do app, com link para o dashboard. */
export function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      {/* biome-ignore lint/performance/noImgElement: ícone SVG estático, não precisa de otimização */}
      <img src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
      <span>Concursos</span>
    </Link>
  );
}
