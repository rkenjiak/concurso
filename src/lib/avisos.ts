/**
 * Avisos (toasts) do app (#100, D4): fila, expiração com pausa e deduplicação, em funções puras
 * sobre um estado imutável. O relógio entra como parâmetro (`agora`, em ms) para ser testável; o
 * componente `AvisosProvider` só agenda um único timer para {@link proximoVencimentoMs}.
 *
 * Regras:
 * - no máximo {@link MAX_VISIVEIS} visíveis; os demais esperam na fila e só começam a contar quando
 *   aparecem (a fila guarda até {@link MAX_FILA}; além disso descarta os mais antigos);
 * - expiração padrão de {@link DURACAO_PADRAO_MS}; erro ou aviso com ação duram
 *   {@link DURACAO_LONGA_MS} (mais tempo para ler e agir); `Infinity` = só fecha manualmente;
 * - aviso pausado (hover, foco ou ação em andamento) não conta tempo e retoma do que restava;
 * - deduplicação: um aviso igual (mesma `chave`, ou mesmo tipo e texto sem chave) substitui o
 *   anterior em vez de empilhar — o novo entra no fim, com tempo cheio, e é anunciado de novo.
 */

export type TipoAviso = "ok" | "erro" | "info";

export interface AcaoAviso {
  /** Rótulo do botão (ex.: "Desfazer"). */
  rotulo: string;
  /** Executada ao clicar; o aviso mostra a pendência até a promessa terminar e então fecha. */
  executar: () => Promise<void> | void;
}

export interface NovoAviso {
  texto: string;
  /** Padrão: "ok". */
  tipo?: TipoAviso;
  acao?: AcaoAviso;
  /** Tempo visível (sem contar pausas). Padrão: {@link duracaoPadrao}. */
  duracaoMs?: number;
  /** Identidade para deduplicar (ex.: `status-42`); sem ela, compara tipo + texto. */
  chave?: string;
}

export interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
  acao?: AcaoAviso;
  chave?: string;
  /** Tempo que faltava na última vez que o relógio parou (ou o total, se nunca correu). */
  restanteMs: number;
  /** Pausado por hover, foco ou ação em andamento. */
  pausado: boolean;
  /** Instante em que o relógio voltou a correr; `null` = parado (pausado ou na fila). */
  desde: number | null;
}

export interface EstadoAvisos {
  avisos: readonly Aviso[];
  proximoId: number;
}

export const MAX_VISIVEIS = 3;
export const MAX_FILA = 10;
export const DURACAO_PADRAO_MS = 6000;
export const DURACAO_LONGA_MS = 9000;

export const ESTADO_INICIAL: EstadoAvisos = { avisos: [], proximoId: 1 };

/** Duração padrão: erro ou aviso com ação ficam mais tempo. */
export function duracaoPadrao(tipo: TipoAviso, temAcao: boolean): number {
  return tipo === "erro" || temAcao ? DURACAO_LONGA_MS : DURACAO_PADRAO_MS;
}

/** Os avisos exibidos (os primeiros da fila, mais antigo em cima). */
export function visiveis(estado: EstadoAvisos): readonly Aviso[] {
  return estado.avisos.slice(0, MAX_VISIVEIS);
}

function restante(aviso: Aviso, agora: number): number {
  return aviso.desde === null ? aviso.restanteMs : aviso.restanteMs - (agora - aviso.desde);
}

/** Para o relógio do aviso guardando o que faltava. */
function parar(aviso: Aviso, agora: number): Aviso {
  return aviso.desde === null
    ? aviso
    : { ...aviso, restanteMs: restante(aviso, agora), desde: null };
}

/** Garante que só os visíveis e não pausados contam tempo. */
function normalizar(avisos: readonly Aviso[], agora: number): readonly Aviso[] {
  return avisos.map((a, i) => {
    const corre = i < MAX_VISIVEIS && !a.pausado;
    if (corre) return a.desde === null ? { ...a, desde: agora } : a;
    return parar(a, agora);
  });
}

function mesmoAviso(a: Aviso, novo: { texto: string; tipo: TipoAviso; chave?: string }): boolean {
  if (novo.chave !== undefined || a.chave !== undefined) return a.chave === novo.chave;
  return a.tipo === novo.tipo && a.texto === novo.texto;
}

/** Enfileira um aviso (deduplicando) e devolve o novo estado e o id atribuído. */
export function adicionar(
  estado: EstadoAvisos,
  novo: NovoAviso,
  agora: number,
): { estado: EstadoAvisos; id: number } {
  const tipo = novo.tipo ?? "ok";
  const duracao =
    novo.duracaoMs !== undefined && novo.duracaoMs > 0
      ? novo.duracaoMs
      : duracaoPadrao(tipo, novo.acao !== undefined);
  const id = estado.proximoId;
  const aviso: Aviso = {
    id,
    texto: novo.texto,
    tipo,
    acao: novo.acao,
    chave: novo.chave,
    restanteMs: duracao,
    pausado: false,
    desde: null,
  };
  const outros = estado.avisos.filter((a) => !mesmoAviso(a, { ...novo, tipo }));
  const fila = [...outros, aviso].slice(-MAX_FILA);
  return { estado: { avisos: normalizar(fila, agora), proximoId: id + 1 }, id };
}

/** Fecha um aviso (o próximo da fila, se houver, aparece e começa a contar). */
export function remover(estado: EstadoAvisos, id: number, agora: number): EstadoAvisos {
  if (!estado.avisos.some((a) => a.id === id)) return estado;
  return {
    ...estado,
    avisos: normalizar(
      estado.avisos.filter((a) => a.id !== id),
      agora,
    ),
  };
}

/** Pausa ou retoma a contagem de um aviso. */
export function definirPausa(
  estado: EstadoAvisos,
  id: number,
  pausado: boolean,
  agora: number,
): EstadoAvisos {
  const alvo = estado.avisos.find((a) => a.id === id);
  if (!alvo || alvo.pausado === pausado) return estado;
  const avisos = estado.avisos.map((a) => (a.id === id ? { ...parar(a, agora), pausado } : a));
  return { ...estado, avisos: normalizar(avisos, agora) };
}

/** Remove os avisos cujo tempo acabou. Devolve o mesmo objeto se nada mudou. */
export function expirar(estado: EstadoAvisos, agora: number): EstadoAvisos {
  const vencidos = estado.avisos.filter((a) => a.desde !== null && restante(a, agora) <= 0);
  if (vencidos.length === 0) return estado;
  return {
    ...estado,
    avisos: normalizar(
      estado.avisos.filter((a) => !vencidos.includes(a)),
      agora,
    ),
  };
}

/** Milissegundos até o próximo aviso vencer; `null` = nenhum relógio correndo. */
export function proximoVencimentoMs(estado: EstadoAvisos, agora: number): number | null {
  let menor: number | null = null;
  for (const a of estado.avisos) {
    if (a.desde === null) continue;
    const r = restante(a, agora);
    if (!Number.isFinite(r)) continue;
    menor = menor === null ? r : Math.min(menor, r);
  }
  return menor === null ? null : Math.max(0, menor);
}
