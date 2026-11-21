"use client";

import { CalendarClock, CalendarDays, Clock } from "lucide-react";
import { useSyncExternalStore } from "react";
import { BadgeSituacao } from "@/components/evento/badge-situacao";
import { NomeEvento } from "@/components/evento/nome-evento";
import { COR_URGENCIA } from "@/components/evento/urgencia";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type Contagem, contagemRegressiva, urgenciaContagem } from "@/domain/contagem";
import type { Status, TipoEvento } from "@/domain/enums";
import { ROTULO_TIPO_EVENTO } from "@/domain/labels";
import { descreverDias, nomePrazo, situacaoPrazo } from "@/domain/prazos";
import {
  calcularValidadeFim,
  type DadosValidade,
  DIAS_ALERTA_VALIDADE,
  descreverValidade,
  type SituacaoValidade,
  situacaoValidade,
} from "@/domain/validade";
import { formatarData } from "@/lib/format";
import { type DataISO, diasEntre, ehDataISO, hojeSP } from "@/lib/tz";
import { cn } from "@/lib/utils";
import type { EventoCompartilhado } from "@/server/queries/compartilhamento";

interface CronogramaPublicoProps {
  status: Status;
  validade: DadosValidade;
  eventos: readonly EventoCompartilhado[];
}

interface ItemCronograma {
  chave: string;
  tipo: TipoEvento;
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  concluido: boolean;
  derivado: boolean;
}

const ROTULO_VALIDADE: Readonly<Record<SituacaoValidade, string>> = {
  INDEFINIDA: "Não definida",
  VIGENTE: "Vigente",
  VENCENDO: "Vencendo",
  EXPIRADA: "Expirada",
};

const COR_VALIDADE: Readonly<Record<SituacaoValidade, string>> = {
  INDEFINIDA: "",
  VIGENTE: "bg-emerald-600 text-white",
  VENCENDO: "bg-aviso/15 text-aviso-foreground",
  EXPIRADA: "bg-destructive/10 text-destructive",
};

const inscreverVazio = () => () => {};
const lerHojeCliente = (): DataISO => hojeSP();
const lerHojeServidor = (): DataISO | null => null;

function compararItens(a: ItemCronograma, b: ItemCronograma): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  if (a.hora !== b.hora) {
    if (a.hora === null) return -1;
    if (b.hora === null) return 1;
    return a.hora < b.hora ? -1 : 1;
  }
  if (a.derivado !== b.derivado) return a.derivado ? 1 : -1;
  return 0;
}

function ContagemPublica({ contagem }: { contagem: Contagem }) {
  const cor = COR_URGENCIA[urgenciaContagem(contagem.destaque)];
  return (
    <p
      role="note"
      data-testid="contagem-prova-publica"
      data-destaque={contagem.destaque}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        cor.borda,
        cor.fundo,
      )}
    >
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{contagem.rotulo}</span>
      <span aria-hidden>
        {nomePrazo(contagem.evento)}: {contagem.texto} ·{" "}
        <span className="tabular-nums">{formatarData(contagem.evento.data)}</span>
        {contagem.evento.hora ? ` às ${contagem.evento.hora}` : null}
      </span>
    </p>
  );
}

function ListaItensCronograma({
  itens,
  hoje,
  status,
  passados = false,
}: {
  itens: readonly ItemCronograma[];
  hoje: DataISO | null;
  status: Status;
  passados?: boolean;
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {itens.map((item) => {
        const nome = nomePrazo({ tipo: item.tipo, titulo: item.titulo, derivado: item.derivado });
        const dataValida = ehDataISO(item.data);
        const dias = hoje !== null && dataValida ? diasEntre(hoje, item.data) : null;
        const situacao =
          dias !== null
            ? situacaoPrazo({ tipo: item.tipo, dias, concluido: item.concluido, status })
            : null;
        return (
          <li
            key={item.chave}
            className={cn(
              "space-y-1 p-3 first:rounded-t-lg last:rounded-b-lg",
              passados && "opacity-75",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <NomeEvento
                nome={nome}
                concluido={item.concluido}
                className={cn("font-medium", item.concluido && "text-muted-foreground")}
              />
              {item.titulo && !item.derivado ? (
                <Badge variant="secondary">{ROTULO_TIPO_EVENTO[item.tipo]}</Badge>
              ) : null}
              {situacao ? <BadgeSituacao situacao={situacao} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {formatarData(item.data)}
              </span>
              {item.hora ? (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="size-3.5 shrink-0" aria-hidden />
                  {item.hora}
                </span>
              ) : null}
              {dias !== null ? <span className="text-xs">{descreverDias(dias)}</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Ilha cliente mínima da página pública compartilhada (#129): no HTML em cache (`hoje === null`)
 * renderiza apenas datas absolutas (seguro para ISR + stale-while-revalidate após a meia-noite).
 * No navegador, calcula próximos vs. passados, textos relativos ("hoje / amanhã / em N dias"),
 * contagem regressiva da próxima prova e situação da validade sem nenhum link autenticado.
 */
export function CronogramaPublico({ status, validade, eventos }: CronogramaPublicoProps) {
  const hoje = useSyncExternalStore(inscreverVazio, lerHojeCliente, lerHojeServidor);
  const validadeFim = calcularValidadeFim(validade);

  const itensBase: ItemCronograma[] = eventos.map((e, indice) => ({
    chave: `ev-${indice}`,
    tipo: e.tipo,
    titulo: e.titulo,
    data: e.data,
    hora: e.hora,
    concluido: e.concluido,
    derivado: false,
  }));
  if (validadeFim && !eventos.some((e) => e.tipo === "VALIDADE")) {
    itensBase.push({
      chave: "validade-derivada",
      tipo: "VALIDADE",
      titulo: null,
      data: validadeFim,
      hora: null,
      concluido: false,
      derivado: true,
    });
  }
  itensBase.sort(compararItens);

  const contagem =
    hoje !== null
      ? contagemRegressiva(
          status,
          eventos.map((e, i) => ({ ...e, id: i + 1 })),
          hoje,
        )
      : null;

  const proximos =
    hoje !== null ? itensBase.filter((item) => !item.concluido && item.data >= hoje) : [];
  const passados =
    hoje !== null ? itensBase.filter((item) => item.concluido || item.data < hoje) : [];

  const situacaoVal = hoje !== null && validadeFim ? situacaoValidade(validade, hoje) : null;
  const origemValidade =
    validade.validadeFimManual && ehDataISO(validade.validadeFimManual)
      ? "Data informada manualmente."
      : validade.homologacaoData && validade.validadeMeses
        ? `Homologação em ${formatarData(validade.homologacaoData)} + ${validade.validadeMeses} ${
            validade.validadeMeses === 1 ? "mês" : "meses"
          }${validade.validadeProrrogada ? ", prorrogada por igual período" : ""}.`
        : null;

  return (
    <div className="space-y-6">
      {contagem ? <ContagemPublica contagem={contagem} /> : null}

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>Cronograma e eventos</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {itensBase.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum evento cadastrado.</p>
          ) : hoje === null ? (
            <ListaItensCronograma itens={itensBase} hoje={null} status={status} />
          ) : (
            <div className="space-y-5">
              {proximos.length > 0 ? (
                <section aria-labelledby="compartilhado-proximos" className="space-y-2">
                  <h3 id="compartilhado-proximos" className="font-medium text-sm">
                    Próximos ({proximos.length})
                  </h3>
                  <ListaItensCronograma itens={proximos} hoje={hoje} status={status} />
                </section>
              ) : null}
              {passados.length > 0 ? (
                <section aria-labelledby="compartilhado-passados" className="space-y-2">
                  <h3
                    id="compartilhado-passados"
                    className="font-medium text-muted-foreground text-sm"
                  >
                    Passados e concluídos ({passados.length})
                  </h3>
                  <ListaItensCronograma itens={passados} hoje={hoje} status={status} passados />
                </section>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {validadeFim ? (
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Validade do concurso</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Até {formatarData(validadeFim)}</span>
              {situacaoVal ? (
                <>
                  <Badge
                    variant={situacaoVal.situacao === "INDEFINIDA" ? "outline" : "default"}
                    className={cn(COR_VALIDADE[situacaoVal.situacao])}
                  >
                    {ROTULO_VALIDADE[situacaoVal.situacao]}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {descreverValidade(situacaoVal)}
                  </span>
                </>
              ) : null}
            </div>
            {origemValidade ? (
              <p className="text-muted-foreground text-xs">{origemValidade}</p>
            ) : null}
            {situacaoVal?.situacao === "VENCENDO" ? (
              <p role="status" className="text-aviso-foreground text-sm">
                Faltam {DIAS_ALERTA_VALIDADE} dias ou menos: acompanhe as convocações.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
