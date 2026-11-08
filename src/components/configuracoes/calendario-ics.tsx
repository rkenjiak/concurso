"use client";

import { CalendarPlus, Copy, Download, Link2, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  gerarTokenIcsAcao,
  revogarTokenIcsAcao,
  salvarOpcoesIcsAcao,
} from "@/server/actions/calendario";

/** Caminho do feed assinável (#65). */
export const CAMINHO_FEED_ICS = "/api/calendario.ics";

/** URL `https://…` do feed (Google Calendar → "Do URL"). */
export function urlFeed(origem: string, token: string): string {
  return `${origem}${CAMINHO_FEED_ICS}?token=${encodeURIComponent(token)}`;
}

/** Mesma URL com o esquema `webcal://` (abre o app de calendário do sistema para assinar). */
export function urlWebcal(urlHttps: string): string {
  return urlHttps.replace(/^https?:\/\//, "webcal://");
}

interface Props {
  temToken: boolean;
  incluirConcluidos: boolean;
  incluirEncerrados: boolean;
}

/**
 * Calendário (.ics, #65): link assinável com token pessoal (exibido só ao gerar; o banco guarda
 * só o resumo), revogar/regenerar, opções do feed e download manual de todos os concursos.
 */
export function CalendarioIcs({ temToken: temTokenInicial, ...opcoesIniciais }: Props) {
  const idUrl = useId();
  const { avisar } = useAvisos();
  const [temToken, setTemToken] = useState(temTokenInicial);
  const [url, setUrl] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState(opcoesIniciais);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function gerar() {
    iniciar(async () => {
      const r = await gerarTokenIcsAcao();
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível gerar o link.");
        return;
      }
      setErro(null);
      setCopiado(false);
      setUrl(urlFeed(window.location.origin, r.data.token));
      setTemToken(true);
    });
  }

  function revogar() {
    iniciar(async () => {
      const r = await revogarTokenIcsAcao();
      if (!r.ok) {
        setErro(r.erros._form?.[0] ?? "Não foi possível revogar o link.");
        return;
      }
      setErro(null);
      setUrl(null);
      setTemToken(false);
    });
  }

  function alterarOpcao(chave: keyof typeof opcoes, valor: boolean) {
    const novas = { ...opcoes, [chave]: valor };
    setOpcoes(novas);
    iniciar(async () => {
      const r = await salvarOpcoesIcsAcao(novas);
      if (!r.ok) {
        setOpcoes(opcoes);
        setErro(r.erros._form?.[0] ?? "Não foi possível salvar as opções.");
        return;
      }
      setErro(null);
      // A caixa já mostra o novo estado; o aviso confirma que foi gravado (#100).
      avisar({ texto: "Opções do calendário salvas.", chave: "opcoes-ics" });
    });
  }

  async function copiar() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {temToken
            ? "Há um link de assinatura ativo. Gerar um novo invalida o anterior (o calendário que o usa para de atualizar)."
            : "Nenhum link ativo. Gere um para assinar seus prazos no Google Calendar, Apple Calendar ou Outlook; o calendário notifica no celular."}
        </p>
        {url ? (
          <div className="grid gap-1.5">
            <Label htmlFor={idUrl}>
              Link do calendário (copie agora; ele não será exibido de novo)
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={idUrl}
                value={url}
                readOnly
                className="min-w-0 flex-1 font-mono text-xs"
                data-testid="url-feed-ics"
              />
              <Button type="button" variant="outline" onClick={copiar}>
                <Copy aria-hidden />
                {copiado ? "Copiado" : "Copiar"}
              </Button>
              <Button asChild variant="outline">
                <a href={urlWebcal(url)}>
                  <CalendarPlus aria-hidden />
                  Assinar
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Google Calendar (no computador): Outras agendas → “+” → “Do URL” e cole o link.
              iPhone: toque em “Assinar” ou em Ajustes → Calendário → Contas → Adicionar conta →
              Outra → Adicionar calendário assinado. Quem tiver o link vê seus prazos: não o
              compartilhe.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={gerar} disabled={pendente}>
            <Link2 aria-hidden />
            {temToken ? "Gerar novo link" : "Gerar link de assinatura"}
          </Button>
          {temToken ? (
            <Button type="button" variant="outline" onClick={revogar} disabled={pendente}>
              <Trash2 aria-hidden />
              Revogar
            </Button>
          ) : null}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 font-medium text-sm">O que entra no calendário</legend>
        <div className="flex items-center gap-2">
          <Checkbox
            id="ics-concluidos"
            checked={opcoes.incluirConcluidos}
            disabled={pendente}
            onCheckedChange={(v) => alterarOpcao("incluirConcluidos", v === true)}
          />
          <Label htmlFor="ics-concluidos" className="font-normal">
            Eventos já concluídos (sem alarme)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="ics-encerrados"
            checked={opcoes.incluirEncerrados}
            disabled={pendente}
            onCheckedChange={(v) => alterarOpcao("incluirEncerrados", v === true)}
          />
          <Label htmlFor="ics-encerrados" className="font-normal">
            Eventos de concursos encerrados (empossado, desistiu, cancelado…)
          </Label>
        </div>
        <p className="text-muted-foreground text-xs">
          Valem para o link de assinatura e para o download abaixo. Prazos críticos pendentes
          (inscrição, isenção, boleto, provas, recursos, posse) levam alarmes conforme as regras de
          notificação.
        </p>
      </fieldset>

      {erro ? (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      ) : null}

      <Button asChild variant="outline">
        <a href="/api/export?formato=ics" download>
          <Download aria-hidden />
          Baixar .ics de todos os concursos
        </a>
      </Button>
    </div>
  );
}
