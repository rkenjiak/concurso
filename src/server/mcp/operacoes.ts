/**
 * Operações expostas pelo servidor MCP. Recebem o banco por parâmetro (testáveis com `:memory:`),
 * convertem as entradas da LLM para os valores dos formulários, validam com os mesmos schemas Zod
 * da UI e gravam pelos repositórios. Nenhuma operação exclui dados (exclusões só pela UI).
 *
 * Retornam `{ ok: true, data } | { ok: false, erros }` como as Server Actions; nos lotes, os
 * erros vêm com o caminho do item (ex.: `eventos[2].data`) e nada é gravado.
 */

import { corDoConcurso } from "@/domain/cores";
import { possiveisDuplicados } from "@/domain/duplicados";
import type { Esfera, Status, Uf } from "@/domain/enums";
import { ErroDominio } from "@/domain/erros";
import { calcularValidadeFim } from "@/domain/validade";
import {
  type ConcursoDados,
  concursoEdicaoSchema,
  concursoSchema,
  VALORES_INICIAIS_CONCURSO,
  valoresDoConcurso,
} from "@/lib/schemas/concurso";
import { type EventoDados, type EventoFormValores, eventoSchema } from "@/lib/schemas/evento";
import { type LinkDados, type LinkFormValores, linkSchema } from "@/lib/schemas/link";
import {
  resultadoFaseSchema,
  VALORES_INICIAIS_RESULTADO_FASE,
  valoresDoResultadoFase,
} from "@/lib/schemas/resultado-fase";
import { alterarStatusSchema } from "@/lib/schemas/status";
import { type DataISO, hojeSP } from "@/lib/tz";
import {
  type ErrosAcao,
  executar,
  falha,
  falhaValidacao,
  type ResultadoAcao,
  sucesso,
} from "../actions/resultado";
import type { Db } from "../db/client";
import type { Evento, Link } from "../db/schema";
import { type ConcursoResumo, listarConcursos, obterConcurso } from "../queries/concursos";
import { obterDashboard } from "../queries/dashboard";
import { listarEventos } from "../queries/eventos";
import { obterOpcoesStatus } from "../queries/historico";
import { listarLinks } from "../queries/links";
import { listarResultadosFase } from "../queries/resultados";
import * as repoConcursos from "../repositories/concursos";
import * as repoEventos from "../repositories/eventos";
import * as repoLinks from "../repositories/links";
import * as repoResultados from "../repositories/resultados";
import * as repoStatus from "../repositories/status";
import {
  type ConcursoNovoEntrada,
  type ConcursoParcialEntrada,
  type EventoLoteEntrada,
  type EventoNovoEntrada,
  type LinkLoteEntrada,
  type LinkNovoEntrada,
  type ResultadoEntrada,
  valoresConcurso,
  valoresEvento,
  valoresLink,
  valoresResultado,
} from "./entradas";

type Resposta<T> = ResultadoAcao<T>;
type Falha = { ok: false; erros: ErrosAcao };

const CONCURSO_NAO_ENCONTRADO = "Concurso não encontrado.";

/** Centavos → reais (as entradas e saídas do MCP usam reais). */
const reais = (centavos: number | null) => (centavos == null ? null : centavos / 100);

/** Prefixa os campos dos erros com o caminho do item (`_form` vira o próprio caminho). */
function prefixar(erros: ErrosAcao, caminho: string): ErrosAcao {
  const resultado: ErrosAcao = {};
  for (const [campo, mensagens] of Object.entries(erros)) {
    if (mensagens) resultado[campo === "_form" ? caminho : `${caminho}.${campo}`] = mensagens;
  }
  return resultado;
}

/** Acumula erros de validação de vários itens; `null` se não houver nenhum. */
class Erros {
  private readonly erros: ErrosAcao = {};
  adicionar(erros: ErrosAcao, caminho?: string) {
    Object.assign(this.erros, caminho ? prefixar(erros, caminho) : erros);
  }
  campo(caminho: string, mensagem: string) {
    this.erros[caminho] = [...(this.erros[caminho] ?? []), mensagem];
  }
  falha(): Falha | null {
    return Object.keys(this.erros).length > 0 ? { ok: false, erros: this.erros } : null;
  }
}

// ---------------------------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------------------------

export interface FiltrosMcp {
  busca?: string;
  status?: Status[];
  esfera?: Esfera;
  uf?: Uf;
}

const resumo = (c: ConcursoResumo) => ({
  id: c.id,
  orgao: c.orgao,
  cargo: c.cargo,
  banca: c.banca,
  status: c.status,
  esfera: c.esfera,
  uf: c.uf,
  cidade: c.cidade,
  remuneracao: reais(c.remuneracaoCentavos),
  proximaData: c.proximaData,
  tags: c.tags,
  cadastradoEm: c.createdAt.toISOString(),
});

export type ResumoMcp = ReturnType<typeof resumo>;

/** Lista com busca e filtros (mesma lógica da tela de lista), por próxima data. */
export async function listar(
  db: Db,
  filtros: FiltrosMcp = {},
  hoje: DataISO = hojeSP(),
): Promise<ResumoMcp[]> {
  const lista = await listarConcursos(
    db,
    {
      busca: filtros.busca?.trim() || null,
      status: filtros.status ?? [],
      esfera: filtros.esfera ?? null,
      uf: filtros.uf ?? null,
      ordem: "proxima_data",
    },
    hoje,
  );
  return lista.map(resumo);
}

const fichaEvento = (e: Evento) => ({
  id: e.id,
  tipo: e.tipo,
  titulo: e.titulo,
  data: e.data,
  hora: e.hora,
  local: e.local,
  observacao: e.observacao,
  concluido: e.concluido,
});

const fichaLink = (l: Link) => ({ id: l.id, tipo: l.tipo, rotulo: l.rotulo, url: l.url });

/** Concurso completo: dados, eventos, links, tags, histórico, resultados e transições. */
export async function obterFicha(db: Db, id: number) {
  const c = await obterConcurso(db, id);
  if (!c) return null;
  const [eventos, links, resultados, status] = await Promise.all([
    listarEventos(db, id),
    listarLinks(db, id),
    listarResultadosFase(db, id),
    obterOpcoesStatus(db, id, c.status),
  ]);
  return {
    id: c.id,
    orgao: c.orgao,
    cargo: c.cargo,
    banca: c.banca,
    esfera: c.esfera,
    uf: c.uf,
    cidade: c.cidade,
    escolaridade: c.escolaridade,
    remuneracao: reais(c.remuneracaoCentavos),
    taxaInscricao: reais(c.taxaInscricaoCentavos),
    vagasAmpla: c.vagasAmpla,
    vagasCotas: c.vagasCotas,
    vagasCadastroReserva: c.vagasCadastroReserva,
    possuiCadastroReserva: c.possuiCadastroReserva,
    status: c.status,
    statusDesde: c.statusDesde.toISOString(),
    transicoesPermitidas: status.opcoes.transicoes,
    observacoes: c.observacoes,
    tags: c.tags,
    // `null` = cor automática (a exibida fica em `corExibida`).
    cor: c.cor,
    corExibida: corDoConcurso(c),
    icone: c.icone,
    homologacaoData: c.homologacaoData,
    validadeMeses: c.validadeMeses,
    validadeProrrogada: c.validadeProrrogada,
    validadeFimManual: c.validadeFimManual,
    validadeFim: calcularValidadeFim(c),
    eventos: eventos.map(fichaEvento),
    links: links.map(fichaLink),
    resultados: resultados.map(({ concursoId: _, ordem: __, ...r }) => r),
    historico: status.historico.map((h) => ({
      de: h.de,
      para: h.para,
      alteradoEm: h.alteradoEm.toISOString(),
      observacao: h.observacao,
    })),
  };
}

export type FichaMcp = NonNullable<Awaited<ReturnType<typeof obterFicha>>>;

/** Próximos prazos do painel (vencidos, hoje e até `janelaDias` dias). */
export async function proximosPrazos(db: Db, janelaDias: number, hoje: DataISO = hojeSP()) {
  const { prazos } = await obterDashboard(db, hoje, janelaDias);
  const item = (p: (typeof prazos.proximos)[number]) => ({
    concursoId: p.concurso.id,
    concurso: `${p.concurso.orgao} — ${p.concurso.cargo}`,
    eventoId: p.evento?.id ?? null,
    tipo: p.tipo,
    titulo: p.titulo,
    data: p.data,
    hora: p.hora,
    dias: p.dias,
    critico: p.critico,
    // Preferência de exibição do dashboard (#44): a LLM continua vendo todos os prazos.
    ocultoNoDashboard: p.oculto,
  });
  return {
    hoje,
    vencidos: prazos.vencidos.map(item),
    hojeMesmo: prazos.hoje.map(item),
    proximos: prazos.proximos.map(item),
  };
}

/** Concursos já cadastrados com órgão e cargo parecidos. */
export async function verificarDuplicados(
  db: Db,
  alvo: { orgao: string; cargo: string },
): Promise<ResumoMcp[]> {
  return possiveisDuplicados(alvo, await listar(db));
}

// ---------------------------------------------------------------------------------------------
// Escritas
// ---------------------------------------------------------------------------------------------

const VALORES_EVENTO_VAZIO: EventoFormValores = {
  tipo: "OUTRO",
  titulo: "",
  data: "",
  hora: "",
  local: "",
  observacao: "",
  concluido: false,
};

const VALORES_LINK_VAZIO: LinkFormValores = { tipo: "OUTRO", rotulo: "", url: "" };

/** Valida um evento novo; exige `tipo` e `data` explícitos. */
function validarEventoNovo(entrada: EventoNovoEntrada, caminho: string, erros: Erros) {
  const r = eventoSchema.safeParse(valoresEvento(VALORES_EVENTO_VAZIO, entrada));
  if (r.success) return r.data;
  erros.adicionar(falhaValidacao(r.error).erros, caminho);
  return null;
}

function validarLinkNovo(entrada: LinkNovoEntrada, caminho: string, erros: Erros) {
  const r = linkSchema.safeParse(valoresLink(VALORES_LINK_VAZIO, entrada));
  if (r.success) return r.data;
  erros.adicionar(falhaValidacao(r.error).erros, caminho);
  return null;
}

const dadosParaSaida = (d: ConcursoDados) => ({
  ...d,
  remuneracao: reais(d.remuneracao),
  taxaInscricao: reais(d.taxaInscricao),
});

export interface EntradaCadastro {
  concurso: ConcursoNovoEntrada;
  eventos?: EventoNovoEntrada[];
  links?: LinkNovoEntrada[];
  /** `true`: só valida e devolve o que seria gravado. */
  simular?: boolean;
  /** `true`: cadastra mesmo havendo concurso parecido. */
  ignorarDuplicados?: boolean;
}

export type ResultadoCadastro =
  | {
      simulacao: true;
      concurso: ReturnType<typeof dadosParaSaida>;
      eventos: EventoDados[];
      links: LinkDados[];
      possiveisDuplicados: ResumoMcp[];
    }
  | { simulacao: false; id: number; eventos: number; links: number };

/**
 * Cadastra UM cargo do edital: concurso + eventos + links + tags numa transação. Com
 * `simular`, só valida. Recusa se houver concurso parecido, salvo `ignorarDuplicados`.
 */
export async function cadastrar(
  db: Db,
  entrada: EntradaCadastro,
  agora: Date = new Date(),
): Promise<Resposta<ResultadoCadastro>> {
  const erros = new Erros();
  const concurso = concursoSchema.safeParse(
    valoresConcurso(
      { ...VALORES_INICIAIS_CONCURSO, status: "EDITAL_PUBLICADO" },
      { status: "EDITAL_PUBLICADO", ...entrada.concurso },
    ),
  );
  if (!concurso.success) erros.adicionar(falhaValidacao(concurso.error).erros, "concurso");
  const eventos = (entrada.eventos ?? []).map((e, i) =>
    validarEventoNovo(e, `eventos[${i}]`, erros),
  );
  const links = (entrada.links ?? []).map((l, i) => validarLinkNovo(l, `links[${i}]`, erros));
  const invalido = erros.falha();
  if (invalido || !concurso.success) return invalido ?? falha("Dados inválidos.");
  const eventosOk = eventos.filter((e): e is EventoDados => e !== null);
  const linksOk = links.filter((l): l is LinkDados => l !== null);

  return executar<ResultadoCadastro>(async () => {
    const duplicados = await verificarDuplicados(db, concurso.data);
    if (entrada.simular) {
      return sucesso({
        simulacao: true as const,
        concurso: dadosParaSaida(concurso.data),
        eventos: eventosOk,
        links: linksOk,
        possiveisDuplicados: duplicados,
      });
    }
    if (duplicados.length > 0 && !entrada.ignorarDuplicados) {
      const lista = duplicados.map((d) => `#${d.id} ${d.orgao} — ${d.cargo} (${d.status})`);
      return falha(
        `Já existe concurso parecido: ${lista.join("; ")}. Confirme com o usuário e, se for ` +
          "mesmo outro concurso, repita com ignorarDuplicados: true; senão, atualize o existente.",
      );
    }
    const id = await repoConcursos.criarConcursoCompleto(
      db,
      concurso.data,
      eventosOk,
      linksOk,
      agora,
    );
    return sucesso({
      simulacao: false as const,
      id,
      eventos: eventosOk.length,
      links: linksOk.length,
    });
  });
}

/** Atualiza só os campos informados (`null` limpa). Não muda o status. */
export async function atualizar(
  db: Db,
  id: number,
  campos: ConcursoParcialEntrada,
): Promise<Resposta<{ id: number }>> {
  return executar(async () => {
    const atual = await obterConcurso(db, id);
    if (!atual) return falha(CONCURSO_NAO_ENCONTRADO);
    const dados = concursoEdicaoSchema.safeParse(valoresConcurso(valoresDoConcurso(atual), campos));
    if (!dados.success) return falhaValidacao(dados.error);
    await repoConcursos.atualizarConcurso(db, id, dados.data);
    return sucesso({ id });
  });
}

/** Muda o status validando a transição e registrando o histórico (como na UI). */
export async function alterarStatus(
  db: Db,
  id: number,
  entrada: { para: Status; observacao?: string | null },
  agora: Date = new Date(),
): Promise<Resposta<{ id: number; status: Status }>> {
  const dados = alterarStatusSchema.safeParse({ ...entrada, observacao: entrada.observacao ?? "" });
  if (!dados.success) return falhaValidacao(dados.error);
  return executar(async () => {
    const atual = await obterConcurso(db, id);
    if (!atual) return falha(CONCURSO_NAO_ENCONTRADO);
    try {
      await repoStatus.alterarStatus(db, id, dados.data.para, dados.data.observacao, agora);
    } catch (erro) {
      if (!(erro instanceof ErroDominio)) throw erro;
      const { opcoes } = await obterOpcoesStatus(db, id, atual.status);
      return falha(
        `${erro.message} Status atual: ${atual.status}. Permitidos: ` +
          `${opcoes.transicoes.join(", ") || "nenhum"}.`,
      );
    }
    return sucesso({ id, status: dados.data.para });
  });
}

const valoresDoEvento = (e: Evento): EventoFormValores => ({
  tipo: e.tipo,
  titulo: e.titulo ?? "",
  data: e.data,
  hora: e.hora ?? "",
  local: e.local ?? "",
  observacao: e.observacao ?? "",
  concluido: e.concluido,
});

/**
 * Cria (sem `id`) e atualiza (com `id`, só os campos informados) eventos do concurso numa
 * transação. Para criar, `tipo` e `data` são obrigatórios. Nunca exclui.
 */
export async function salvarEventos(
  db: Db,
  concursoId: number,
  itens: EventoLoteEntrada[],
  agora: Date = new Date(),
): Promise<Resposta<{ ids: number[] }>> {
  return executar(async () => {
    if (!(await obterConcurso(db, concursoId))) return falha(CONCURSO_NAO_ENCONTRADO);
    const existentes = new Map((await listarEventos(db, concursoId)).map((e) => [e.id, e]));
    const erros = new Erros();
    const lote: repoEventos.ItemEvento[] = [];
    for (const [i, item] of itens.entries()) {
      const caminho = `eventos[${i}]`;
      if (item.id === undefined) {
        if (!item.tipo) {
          erros.campo(`${caminho}.tipo`, "Informe o tipo para criar.");
          continue;
        }
        const novo = { ...item, tipo: item.tipo, data: item.data ?? "" };
        const dados = validarEventoNovo(novo, caminho, erros);
        if (dados) lote.push({ id: null, dados });
        continue;
      }
      const atual = existentes.get(item.id);
      if (!atual) {
        erros.campo(`${caminho}.id`, "Evento não encontrado neste concurso.");
        continue;
      }
      const r = eventoSchema.safeParse(valoresEvento(valoresDoEvento(atual), item));
      if (r.success) lote.push({ id: item.id, dados: r.data });
      else erros.adicionar(falhaValidacao(r.error).erros, caminho);
    }
    const invalido = erros.falha();
    if (invalido) return invalido;
    return sucesso({ ids: await repoEventos.salvarEventos(db, concursoId, lote, agora) });
  });
}

/** Cria (sem `id`) e atualiza (com `id`) links do concurso numa transação. Nunca exclui. */
export async function salvarLinks(
  db: Db,
  concursoId: number,
  itens: LinkLoteEntrada[],
): Promise<Resposta<{ ids: number[] }>> {
  return executar(async () => {
    if (!(await obterConcurso(db, concursoId))) return falha(CONCURSO_NAO_ENCONTRADO);
    const existentes = new Map((await listarLinks(db, concursoId)).map((l) => [l.id, l]));
    const erros = new Erros();
    const lote: repoLinks.ItemLink[] = [];
    for (const [i, item] of itens.entries()) {
      const caminho = `links[${i}]`;
      if (item.id === undefined) {
        if (!item.tipo) {
          erros.campo(`${caminho}.tipo`, "Informe o tipo para criar.");
          continue;
        }
        const novo = { ...item, tipo: item.tipo, url: item.url ?? "" };
        const dados = validarLinkNovo(novo, caminho, erros);
        if (dados) lote.push({ id: null, dados });
        continue;
      }
      const atual = existentes.get(item.id);
      if (!atual) {
        erros.campo(`${caminho}.id`, "Link não encontrado neste concurso.");
        continue;
      }
      const base = { tipo: atual.tipo, rotulo: atual.rotulo ?? "", url: atual.url };
      const r = linkSchema.safeParse(valoresLink(base, item));
      if (r.success) lote.push({ id: item.id, dados: r.data });
      else erros.adicionar(falhaValidacao(r.error).erros, caminho);
    }
    const invalido = erros.falha();
    if (invalido) return invalido;
    return sucesso({ ids: await repoLinks.salvarLinks(db, concursoId, lote) });
  });
}

/** Cria (sem `id`, `fase` obrigatória) ou atualiza (com `id`) o resultado de uma fase. */
export async function registrarResultado(
  db: Db,
  concursoId: number,
  entrada: ResultadoEntrada,
): Promise<Resposta<{ id: number }>> {
  return executar(async () => {
    if (!(await obterConcurso(db, concursoId))) return falha(CONCURSO_NAO_ENCONTRADO);
    let base = VALORES_INICIAIS_RESULTADO_FASE;
    if (entrada.id !== undefined) {
      const atual = (await listarResultadosFase(db, concursoId)).find((r) => r.id === entrada.id);
      if (!atual) return falha("Resultado não encontrado neste concurso.");
      base = valoresDoResultadoFase(atual);
    } else if (!entrada.fase) {
      return { ok: false, erros: { fase: ["Informe a fase para criar o resultado."] } };
    }
    const dados = resultadoFaseSchema.safeParse(valoresResultado(base, entrada));
    if (!dados.success) return falhaValidacao(dados.error);
    if (entrada.id !== undefined) {
      await repoResultados.atualizarResultadoFase(db, concursoId, entrada.id, dados.data);
      return sucesso({ id: entrada.id });
    }
    return sucesso({ id: await repoResultados.criarResultadoFase(db, concursoId, dados.data) });
  });
}
