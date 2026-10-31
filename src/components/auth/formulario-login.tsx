"use client";

import { LogIn } from "lucide-react";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EstadoLogin, login } from "@/server/actions/auth";

const INICIAL: EstadoLogin = { erro: null };

/** Formulário de senha única (funciona também sem JavaScript). */
export function FormularioLogin({ para }: { para: string }) {
  const [estado, acao, pendente] = useActionState(login, INICIAL);
  const idSenha = useId();
  const idErro = useId();

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="para" value={para} />
      <div className="grid gap-1.5">
        <Label htmlFor={idSenha}>Senha</Label>
        <Input
          id={idSenha}
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={estado.erro ? true : undefined}
          aria-describedby={estado.erro ? idErro : undefined}
        />
      </div>
      {estado.erro ? (
        <p id={idErro} role="alert" className="text-destructive text-sm">
          {estado.erro}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pendente}>
        <LogIn aria-hidden />
        {pendente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
