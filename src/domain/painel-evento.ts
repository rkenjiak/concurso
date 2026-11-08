/**
 * Dados do painel de evento (#100, itens 6–9): um formato único, serializável, para os prazos do
 * dashboard e os itens do calendário. Funções puras: sem Next, sem banco e sem relógio.
 */
import type { DataISO } from "../lib/tz";
import type { CorConcurso } from "./cores";
import type { Status, TipoEvento } from "./enums";
import { concursoAcompanhado, nomePrazo, type SituacaoPrazo, situacaoPrazo } from "./prazos";

/** Evento cadastrado, com os campos que o formulário de edição precisa. */
export interface EventoEditavel {
  id: number;
  tipo: TipoEvento;
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  local: string | null;
  observacao: string | null;
  concluido: boolean;
}

export interface ConcursoDoPainel {
  id: number;
  orgao: string;
  cargo: string;
  status: Status;
  cor: CorConcurso;
  icone: string | null;
}

/** Linha do resumo "Próximos eventos do concurso". */
export interface ProximoDoPainel {
  chave: string;
  nome: string;
  data: DataISO;
  hora: string | null;
}

export interface EventoPainel {
  /** Chave do prazo (`evento-<id>` ou `validade-<concursoId>`), a mesma do dashboard (#44). */
  chave: string;
  nome: string;
  /** Pseudo-evento "Fim da validade" (derivado): não se conclui nem se edita. */
  derivado: boolean;
  /** Evento cadastrado; `null` na validade derivada. */
  evento: EventoEditavel | null;
  data: DataISO;
  hora: string | null;
  local: string | null;
  concluido: boolean;
  /**
   * Situação do badge **sem** considerar a conclusão (a UI mostra "Concluído" quando o evento está
   * concluído, inclusive de forma otimista, e esta situação ao reabrir).
   */
  situacao: SituacaoPrazo | null;
  /**
   * Estado no dashboard: `true`/`false` = oculto ou não; `null` = o item não é listado no
   * dashboard (concluído ou de concurso encerrado) e o painel não oferece ocultar.
   */
  oculto: boolean | null;
  concurso: ConcursoDoPainel;
  proximos: ProximoDoPainel[];
}

/** Dados mínimos de um prazo ou item de calendário para montar o painel. */
interface FontePainel {
  chave: string;
  tipo: TipoEvento;
  titulo: string | null;
  data: DataISO;
  hora: string | null;
  dias: number;
  critico: boolean;
  derivado: boolean;
  evento:
    | (Omit<EventoEditavel, "local" | "observacao"> & {
        local?: string | null;
        observacao?: string | null;
        ocultoDashboard?: boolean;
      })
    | null;
  concurso: ConcursoDoPainel & { validadeOcultaDashboard?: boolean };
}

const pegarConcurso = ({ id, orgao, cargo, status, cor, icone }: ConcursoDoPainel) => ({
  id,
  orgao,
  cargo,
  status,
  cor,
  icone,
});

const resumir = (
  p: Pick<FontePainel, "chave" | "tipo" | "titulo" | "derivado" | "data" | "hora">,
) => ({
  chave: p.chave,
  nome: nomePrazo(p),
  data: p.data,
  hora: p.hora,
});

/**
 * O item aparece (ou aparecerá, ao entrar na janela) em "Próximos prazos": pendente, de concurso
 * acompanhado e, se já passou, de tipo crítico (os vencidos não críticos saem do dashboard). Só
 * nesses casos o painel oferece "Ocultar do dashboard" (#100: decisão para o calendário).
 */
export function apareceNoDashboard(p: {
  concluido: boolean;
  dias: number;
  critico: boolean;
  status: Status;
}): boolean {
  return !p.concluido && concursoAcompanhado(p.status) && (p.dias >= 0 || p.critico);
}

/**
 * Normaliza um prazo do dashboard ou um item do calendário para o painel. `oculto` vem do prazo
 * (dashboard); ausente, é lido das preferências do evento/concurso, se o item aparece no
 * dashboard ({@link apareceNoDashboard}).
 */
export function paraPainel(
  p: FontePainel & { oculto?: boolean },
  proximos: readonly Pick<
    FontePainel,
    "chave" | "tipo" | "titulo" | "derivado" | "data" | "hora"
  >[],
): EventoPainel {
  const concluido = p.evento?.concluido ?? false;
  const aparece = apareceNoDashboard({
    concluido,
    dias: p.dias,
    critico: p.critico,
    status: p.concurso.status,
  });
  const ocultoPreferencia = p.evento
    ? p.evento.ocultoDashboard === true
    : p.concurso.validadeOcultaDashboard === true;
  return {
    chave: p.chave,
    nome: nomePrazo(p),
    derivado: p.derivado,
    evento: p.evento
      ? {
          id: p.evento.id,
          tipo: p.evento.tipo,
          titulo: p.evento.titulo,
          data: p.evento.data,
          hora: p.evento.hora,
          local: p.evento.local ?? null,
          observacao: p.evento.observacao ?? null,
          concluido,
        }
      : null,
    data: p.data,
    hora: p.hora,
    local: p.evento?.local ?? null,
    concluido,
    situacao: situacaoPrazo({ tipo: p.tipo, dias: p.dias, status: p.concurso.status }),
    oculto: p.oculto ?? (aparece ? ocultoPreferencia : null),
    concurso: pegarConcurso(p.concurso),
    proximos: proximos.map(resumir),
  };
}
