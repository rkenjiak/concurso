"use client";

import { Loader2, RotateCcw, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { TipoEvento } from "@/domain/enums";
import { ROTULO_TIPO_EVENTO } from "@/domain/labels";
import { formatarAntecedencias, REGRAS_PADRAO, type RegraNotificacao } from "@/domain/notificacoes";
import { ehTipoCritico } from "@/domain/prazos";
import {
  restaurarRegrasPadraoAcao,
  salvarRegrasNotificacaoAcao,
} from "@/server/actions/notificacoes";

interface Linha {
  tipo: TipoEvento;
  ativo: boolean;
  antecedencias: string;
}

const rotulo = (tipo: TipoEvento) =>
  tipo === "VALIDADE" ? "Fim da validade do concurso" : ROTULO_TIPO_EVENTO[tipo];

const paraLinhas = (regras: readonly RegraNotificacao[]): Linha[] =>
  regras.map((r) => ({
    tipo: r.tipo,
    ativo: r.ativo,
    antecedencias: formatarAntecedencias(r.antecedencias),
  }));

/**
 * Regras de notificação (#65): por tipo de evento, ligar/desligar e as antecedências em dias
 * (0 = no dia). "Restaurar padrão" volta tudo ao conjunto que vem pronto.
 */
export function RegrasNotificacao({ regras }: { regras: readonly RegraNotificacao[] }) {
  const [linhas, setLinhas] = useState<Linha[]>(() => paraLinhas(regras));
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function alterar(tipo: TipoEvento, mudanca: Partial<Linha>) {
    setMensagem(null);
    setLinhas((atual) => atual.map((l) => (l.tipo === tipo ? { ...l, ...mudanca } : l)));
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);
    iniciar(async () => {
      const r = await salvarRegrasNotificacaoAcao(linhas);
      if (r.ok) {
        setErros({});
        setMensagem({ tipo: "ok", texto: "Regras salvas." });
      } else {
        setErros(r.erros);
        setMensagem({ tipo: "erro", texto: r.erros._form?.[0] ?? "Não foi possível salvar." });
      }
    });
  }

  function restaurar() {
    setMensagem(null);
    iniciar(async () => {
      const r = await restaurarRegrasPadraoAcao();
      if (r.ok) {
        setErros({});
        setLinhas(paraLinhas(Object.values(REGRAS_PADRAO)));
        setMensagem({ tipo: "ok", texto: "Regras restauradas para o padrão." });
      } else {
        setMensagem({ tipo: "erro", texto: r.erros._form?.[0] ?? "Não foi possível restaurar." });
      }
    });
  }

  return (
    <form onSubmit={salvar} className="space-y-4" aria-label="Regras de notificação">
      <ul className="divide-y rounded-lg border">
        {linhas.map((l) => {
          const id = `regra-${l.tipo}`;
          const erro = erros[l.tipo]?.[0];
          const padrao = REGRAS_PADRAO[l.tipo];
          return (
            <li
              key={l.tipo}
              className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`${id}-ativo`}
                  checked={l.ativo}
                  onCheckedChange={(v) => alterar(l.tipo, { ativo: v === true })}
                  className="mt-0.5"
                />
                <div className="min-w-0 space-y-0.5">
                  <label htmlFor={`${id}-ativo`} className="font-medium text-sm">
                    {rotulo(l.tipo)}
                  </label>
                  <p className="text-muted-foreground text-xs">
                    Padrão:{" "}
                    {padrao.ativo
                      ? `${formatarAntecedencias(padrao.antecedencias)} dia(s) antes`
                      : "desligado"}
                    {ehTipoCritico(l.tipo) ? " · também gera alarme no calendário" : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-1 pl-7 sm:pl-0">
                <label htmlFor={`${id}-dias`} className="sr-only">
                  Antecedências de {rotulo(l.tipo)}, em dias
                </label>
                <Input
                  id={`${id}-dias`}
                  value={l.antecedencias}
                  inputMode="numeric"
                  placeholder="7, 1, 0"
                  aria-invalid={erro ? true : undefined}
                  aria-describedby={erro ? `${id}-erro` : undefined}
                  onChange={(e) => alterar(l.tipo, { antecedencias: e.target.value })}
                />
                {erro ? (
                  <p id={`${id}-erro`} className="text-destructive text-xs">
                    {erro}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground text-xs">
        Antecedências em dias antes do prazo, separadas por vírgula; 0 = no próprio dia.
      </p>
      {mensagem ? (
        <p
          role={mensagem.tipo === "erro" ? "alert" : "status"}
          className={mensagem.tipo === "erro" ? "text-destructive text-sm" : "text-sm"}
        >
          {mensagem.texto}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Salvar regras
        </Button>
        <Button type="button" variant="outline" onClick={restaurar} disabled={pendente}>
          <RotateCcw aria-hidden />
          Restaurar padrão
        </Button>
      </div>
    </form>
  );
}
