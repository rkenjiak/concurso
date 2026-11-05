/**
 * Registro dos erros de servidor capturados pelo Next (`onRequestError` em
 * `src/instrumentation.ts`, #91): páginas (RSC/SSR), Route Handlers, Server Actions e proxy.
 *
 * Erros já tratados no código (ex.: `executar` nas actions, `/api/import`) não chegam aqui; esses
 * pontos registram o erro por conta própria. O Next continua imprimindo o erro no formato dele;
 * esta linha estruturada é acrescentada, com o `digest` para cruzar as duas.
 */
import { unstable_rethrow } from "next/navigation";
import { log } from "./log";

export interface RequisicaoComErro {
  path: string;
  method: string;
  // `headers` existe mas não é lido: traz o cookie de sessão.
}

export interface ContextoErroRequisicao {
  routePath: string;
  routeType: string;
  renderSource?: string;
}

/**
 * O Next chama o hook mais de uma vez para o mesmo erro na mesma requisição (ex.: layout e página
 * que dependem da mesma query memorizada). O mesmo objeto de erro é registrado uma vez a cada
 * `JANELA_DEDUP_MS`: se ele for relançado em requisições seguintes (ex.: promise rejeitada guardada
 * em módulo), volta a aparecer no log depois da janela.
 */
const JANELA_DEDUP_MS = 2_000;
const registradosEm = new WeakMap<object, number>();

/** Erros de controle do Next (`redirect`, `notFound`, renderização dinâmica…) não são falhas. */
function ehErroDeControle(erro: unknown): boolean {
  try {
    unstable_rethrow(erro);
    return false;
  } catch {
    return true;
  }
}

/**
 * Caminho sem os valores da query (só os nomes dos parâmetros): valores podem trazer tokens,
 * e-mails ou outros dados digitados pelo usuário.
 */
export function caminhoSemValores(path: string): { caminho: string; parametros?: string[] } {
  const interrogacao = path.indexOf("?");
  if (interrogacao < 0) return { caminho: path };
  const nomes = [...new URLSearchParams(path.slice(interrogacao + 1)).keys()];
  return {
    caminho: path.slice(0, interrogacao),
    parametros: nomes.length > 0 ? [...new Set(nomes)] : undefined,
  };
}

export function registrarErroRequisicao(
  erro: unknown,
  requisicao: RequisicaoComErro,
  contexto: ContextoErroRequisicao,
  agora = Date.now(),
): void {
  if (ehErroDeControle(erro)) return;
  if (typeof erro === "object" && erro !== null) {
    const anterior = registradosEm.get(erro);
    if (anterior !== undefined && agora - anterior < JANELA_DEDUP_MS) return;
    registradosEm.set(erro, agora);
  }
  const digest =
    typeof erro === "object" && erro !== null && "digest" in erro
      ? String((erro as { digest: unknown }).digest)
      : undefined;
  log.error("requisicao.erro", {
    metodo: requisicao.method,
    ...caminhoSemValores(requisicao.path),
    rota: contexto.routePath,
    tipo: contexto.routeType,
    origem: contexto.renderSource,
    digest,
    erro: erro instanceof Error ? erro : String(erro),
  });
}
