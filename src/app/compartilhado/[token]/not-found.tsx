import { Link2Off } from "lucide-react";

/** Resposta 404 dedicada da rota pública `/compartilhado/[token]` (#129), sem links autenticados. */
export default function CompartilhadoNaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <Link2Off className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-semibold text-2xl tracking-tight">Link não encontrado</h1>
      <p className="text-muted-foreground text-sm">
        Este link de compartilhamento não existe, foi revogado ou não está mais disponível.
      </p>
    </main>
  );
}
