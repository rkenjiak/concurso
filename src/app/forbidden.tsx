import { ShieldX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Resposta 403 (`forbidden()`): página restrita a administradores (#50). */
export default function Proibido() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldX className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-semibold text-2xl tracking-tight">Acesso negado</h1>
      <p className="text-muted-foreground text-sm">
        Esta página é restrita a administradores da instância.
      </p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
