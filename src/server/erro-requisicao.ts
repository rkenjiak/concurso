/**
 * Registro dos erros de servidor capturados pelo Next (`onRequestError` em
 * `src/instrumentation.ts`, #91): páginas (RSC/SSR), Route Handlers, Server Actions e proxy.
 *
 * Erros já tratados no código (ex.: `executar` nas actions, `/api/import`) não chegam aqui; esses
 * pontos registram o erro por conta própria. O Next continua imprimindo o erro no formato dele;
 * esta linha estruturada é acrescentada, com o `digest` para cruzar as duas.
 */
import { unstable_rethrow } from "next/navigation";
import { log, semSegredosNaUrl } from "./log";

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
 * O Next pode chamar o hook mais de uma vez para o mesmo erro (ex.: layout e página que dependem
 * da mesma query memorizada). Registra cada objeto de erro uma vez só.
 */
const jaRegistrados = new WeakSet<object>();

/** Erros de controle do Next (`redirect`, `notFound`, renderização dinâmica…) não são falhas. */
function ehErroDeControle(erro: unknown): boolean {
  try {
    unstable_rethrow(erro);
    return false;
  } catch {
    return true;
  }
}

export function registrarErroRequisicao(
  erro: unknown,
  requisicao: RequisicaoComErro,
  contexto: ContextoErroRequisicao,
): void {
  if (ehErroDeControle(erro)) return;
  if (typeof erro === "object" && erro !== null) {
    if (jaRegistrados.has(erro)) return;
    jaRegistrados.add(erro);
  }
  const digest =
    typeof erro === "object" && erro !== null && "digest" in erro
      ? String((erro as { digest: unknown }).digest)
      : undefined;
  log.error("requisicao.erro", {
    metodo: requisicao.method,
    caminho: semSegredosNaUrl(requisicao.path),
    rota: contexto.routePath,
    tipo: contexto.routeType,
    origem: contexto.renderSource,
    digest,
    erro: erro instanceof Error ? erro : String(erro),
  });
}
