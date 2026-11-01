"use client";

import { Copy, KeyRound, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { gerarTokenMcpAcao, revogarTokenMcpAcao } from "@/server/actions/mcp";

/**
 * Token pessoal do MCP por HTTP (#49): gerar (substitui o anterior), copiar e revogar. O token
 * aparece só logo após ser gerado.
 */
export function TokenMcp({ temToken: temTokenInicial }: { temToken: boolean }) {
  const idToken = useId();
  const [temToken, setTemToken] = useState(temTokenInicial);
  const [token, setToken] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();

  function gerar() {
    iniciar(async () => {
      const r = await gerarTokenMcpAcao();
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível gerar o token.");
        return;
      }
      setErro(null);
      setCopiado(false);
      setToken(r.data.token);
      setTemToken(true);
    });
  }

  function revogar() {
    iniciar(async () => {
      const r = await revogarTokenMcpAcao();
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível revogar o token.");
        return;
      }
      setErro(null);
      setToken(null);
      setTemToken(false);
    });
  }

  async function copiar() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopiado(true);
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {temToken
          ? "Há um token ativo. Gerar um novo invalida o anterior."
          : "Nenhum token ativo: o endpoint /api/mcp recusa conexões em seu nome."}
      </p>
      {token ? (
        <div className="grid gap-1.5">
          <Label htmlFor={idToken}>Novo token (copie agora; ele não será exibido de novo)</Label>
          <div className="flex gap-2">
            <Input id={idToken} value={token} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={copiar}>
              <Copy aria-hidden />
              {copiado ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      ) : null}
      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={gerar} disabled={pendente}>
          <KeyRound aria-hidden />
          {temToken ? "Gerar novo token" : "Gerar token"}
        </Button>
        {temToken ? (
          <Button type="button" variant="outline" onClick={revogar} disabled={pendente}>
            <Trash2 aria-hidden />
            Revogar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
