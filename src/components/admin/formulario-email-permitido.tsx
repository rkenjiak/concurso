"use client";

import { UserPlus } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adicionarEmailPermitidoAcao } from "@/server/actions/admin";

/** Libera um e-mail para entrar com Google (allowlist do painel, #50). */
export function FormularioEmailPermitido() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    iniciar(async () => {
      const r = await adicionarEmailPermitidoAcao(email);
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? Object.values(r.erros).flat()[0] ?? "E-mail inválido.");
        return;
      }
      setErro(null);
      setEmail("");
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-1.5">
      <Label htmlFor={id}>E-mail da conta Google</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={id}
          type="email"
          required
          autoComplete="off"
          placeholder="pessoa@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={erro ? true : undefined}
          className="max-w-sm"
        />
        <Button type="submit" disabled={pendente}>
          <UserPlus aria-hidden />
          Liberar acesso
        </Button>
      </div>
      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
