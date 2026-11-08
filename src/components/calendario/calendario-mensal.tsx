import { AlertTriangle, Clock } from "lucide-react";
import { FiltroConcursos } from "@/components/calendario/filtro-concursos";
import { MarcadorConcurso } from "@/components/concurso/marcador-concurso";
import { NomeEvento } from "@/components/evento/nome-evento";
import { BotaoAbrirEvento } from "@/components/evento/painel-evento";
import { COR_URGENCIA } from "@/components/evento/urgencia";
import { agruparPorData, DIAS_SEMANA, type DiaGrade, type MesISO } from "@/domain/calendario";
import { concursoVisivel, type SelecaoConcursos } from "@/domain/navegacao-calendario";
import { nomePrazo, ROTULO_SITUACAO } from "@/domain/prazos";
import { formatarDataLonga } from "@/lib/format";
import type { DataISO } from "@/lib/tz";
import { cn } from "@/lib/utils";
import type { ItemDoCalendario } from "@/server/queries/calendario";

const NOME_DIA_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

function rotuloItem(item: ItemDoCalendario): string {
  const partes = [nomePrazo(item), `${item.concurso.orgao} — ${item.concurso.cargo}`];
  if (item.hora) partes.push(item.hora);
  if (item.situacao) partes.push(ROTULO_SITUACAO[item.situacao].toLowerCase());
  return partes.join(" · ");
}

/** Item compacto da grade (desktop); abre o painel do evento (#100). */
function ItemGrade({ item }: { item: ItemDoCalendario }) {
  return (
    <li>
      <BotaoAbrirEvento
        chave={item.chave}
        title={rotuloItem(item)}
        aria-label={rotuloItem(item)}
        data-criticidade={item.criticidade}
        data-esmaecido={item.esmaecido || undefined}
        className={cn(
          "block w-full cursor-pointer truncate rounded border-l-4 text-left bg-muted/60 px-1.5 py-0.5 text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
          COR_URGENCIA[item.criticidade].bordaEsquerda,
          COR_URGENCIA[item.criticidade].fundo,
          item.criticidade === "ALTA" && "font-medium",
          item.esmaecido && "text-muted-foreground opacity-60",
        )}
      >
        <MarcadorConcurso
          cor={item.concurso.cor}
          icone={item.concurso.icone}
          tamanho="sm"
          className="mr-1"
        />
        {item.hora ? <span className="tabular-nums">{item.hora} </span> : null}
        <NomeEvento nome={nomePrazo(item)} concluido={item.concluido} /> · {item.concurso.orgao}
      </BotaoAbrirEvento>
    </li>
  );
}

/**
 * Grade mensal (a partir de `md`): semanas de domingo a sábado. Os itens abrem o painel do
 * evento: precisa de um `PainelEventoProvider` acima.
 */
export function GradeMes({
  grade,
  itens,
  titulo,
}: {
  grade: DiaGrade[][];
  itens: readonly ItemDoCalendario[];
  titulo: string;
}) {
  const porData = agruparPorData(itens);
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">{titulo}</caption>
      <thead>
        <tr>
          {DIAS_SEMANA.map((d, i) => (
            <th
              key={d}
              scope="col"
              abbr={NOME_DIA_SEMANA[i]}
              className="pb-2 font-medium text-muted-foreground text-xs uppercase"
            >
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grade.map((semana) => (
          <tr key={semana[0]?.data}>
            {semana.map((dia) => (
              <CelulaDia key={dia.data} dia={dia} itens={porData.get(dia.data) ?? []} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CelulaDia({ dia, itens }: { dia: DiaGrade; itens: readonly ItemDoCalendario[] }) {
  return (
    <td
      aria-current={dia.hoje ? "date" : undefined}
      aria-label={formatarDataLonga(dia.data)}
      data-data={dia.data}
      className={cn(
        "h-28 border p-1 align-top",
        !dia.doMes && "bg-muted/30 text-muted-foreground",
        dia.hoje && "bg-primary/5 ring-2 ring-primary ring-inset",
      )}
    >
      <span
        className={cn(
          "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
          dia.hoje && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {dia.dia}
      </span>
      {dia.doMes && itens.length > 0 ? (
        <ul className="space-y-1">
          {itens.map((item) => (
            <ItemGrade key={item.chave} item={item} />
          ))}
        </ul>
      ) : null}
    </td>
  );
}

/**
 * Agenda do mês (celular): só os dias com itens, em ordem. Os itens abrem o painel do evento:
 * precisa de um `PainelEventoProvider` acima.
 */
export function AgendaMes({
  itens,
  hoje,
  vazio = "Nenhum evento neste mês.",
}: {
  itens: readonly ItemDoCalendario[];
  hoje: DataISO;
  /** Texto quando não há itens (ex.: todos ocultos pelo filtro de concursos). */
  vazio?: string;
}) {
  const porData = agruparPorData(itens);
  if (porData.size === 0) {
    return <p className="py-6 text-center text-muted-foreground text-sm">{vazio}</p>;
  }
  return (
    <ol className="space-y-4">
      {[...porData].map(([data, doDia]) => (
        <li key={data} aria-current={data === hoje ? "date" : undefined}>
          <h3
            className={cn(
              "mb-1 font-medium text-sm first-letter:uppercase",
              data === hoje && "text-primary",
            )}
          >
            {formatarDataLonga(data)}
            {data === hoje ? " · hoje" : null}
          </h3>
          <ul className="divide-y rounded-lg border">
            {doDia.map((item) => (
              <li
                key={item.chave}
                className={cn("border-l-4", COR_URGENCIA[item.criticidade].bordaEsquerda)}
              >
                <BotaoAbrirEvento
                  chave={item.chave}
                  className={cn(
                    "flex w-full cursor-pointer gap-2 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring",
                    item.esmaecido && "text-muted-foreground opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex items-center gap-1.5 font-medium">
                      {item.criticidade === "ALTA" ? (
                        <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
                      ) : null}
                      <NomeEvento nome={nomePrazo(item)} concluido={item.concluido} />
                    </p>
                    <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
                      <MarcadorConcurso cor={item.concurso.cor} icone={item.concurso.icone} />
                      <span className="min-w-0 truncate">
                        {item.concurso.orgao} — {item.concurso.cargo}
                      </span>
                    </p>
                  </div>
                  {item.hora ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                      <Clock className="size-3" aria-hidden />
                      {item.hora}
                    </span>
                  ) : null}
                </BotaoAbrirEvento>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

type ConcursoDoItem = ItemDoCalendario["concurso"];

const compararConcursos = (a: ConcursoDoItem, b: ConcursoDoItem) =>
  a.orgao.localeCompare(b.orgao, "pt-BR") || a.cargo.localeCompare(b.cargo, "pt-BR");

/** Concursos com itens no mês, sem repetição, na ordem de órgão e cargo. */
export function concursosDoMes(itens: readonly ItemDoCalendario[]): ConcursoDoItem[] {
  const porId = new Map(itens.map((i) => [i.concurso.id, i.concurso]));
  return [...porId.values()].sort(compararConcursos);
}

/**
 * Legenda cor/ícone → concurso (#46), clicável para filtrar o calendário (#83). Lista os
 * concursos com itens no mês (antes do filtro, para poder religá-los) e os selecionados, mesmo
 * sem itens no mês, para que a seleção fique sempre visível.
 */
export function LegendaConcursos({
  mes,
  itens,
  concursos,
  selecao,
}: {
  mes: MesISO;
  /** Itens do mês sem o filtro de concursos. */
  itens: readonly ItemDoCalendario[];
  /** Todos os concursos do usuário. */
  concursos: readonly ConcursoDoItem[];
  selecao: SelecaoConcursos;
}) {
  const doMes = concursosDoMes(itens);
  const ids = new Set(doMes.map((c) => c.id));
  const selecionados = concursos.filter((c) => !ids.has(c.id) && concursoVisivel(selecao, c.id));
  const listados = selecao === null ? doMes : [...doMes, ...selecionados].sort(compararConcursos);
  return (
    <FiltroConcursos
      mes={mes}
      concursos={listados.map(({ id, orgao, cargo, cor, icone }) => ({
        id,
        orgao,
        cargo,
        cor,
        icone,
      }))}
      todos={concursos.map((c) => c.id)}
      selecao={selecao}
    />
  );
}
