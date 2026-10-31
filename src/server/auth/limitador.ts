/**
 * Limite de tentativas de login com atraso progressivo (ARQUITETURA.md §7.1). Em memória, por
 * processo: suficiente para um app de um usuário (em serverless, vale por instância).
 */

export interface OpcoesLimitador {
  /** Falhas toleradas antes do primeiro bloqueio. */
  tentativasLivres: number;
  /** Bloqueio após a primeira falha excedente; dobra a cada nova falha. */
  bloqueioInicialMs: number;
  bloqueioMaximoMs: number;
  /** Falhas mais antigas que isto (sem novas tentativas) são esquecidas. */
  esquecerAposMs: number;
  /** Limite de chaves guardadas (as mais antigas são descartadas). */
  maxChaves: number;
}

export const OPCOES_LIMITADOR_PADRAO: OpcoesLimitador = {
  tentativasLivres: 5,
  bloqueioInicialMs: 2_000,
  bloqueioMaximoMs: 15 * 60_000,
  esquecerAposMs: 24 * 60 * 60_000,
  maxChaves: 1_000,
};

interface Registro {
  falhas: number;
  ultimaFalha: number;
  bloqueadoAte: number;
}

export class LimitadorTentativas {
  private readonly registros = new Map<string, Registro>();
  private readonly opcoes: OpcoesLimitador;

  constructor(opcoes: Partial<OpcoesLimitador> = {}) {
    this.opcoes = { ...OPCOES_LIMITADOR_PADRAO, ...opcoes };
  }

  private registro(chave: string, agora: number): Registro | undefined {
    const r = this.registros.get(chave);
    if (r && agora - r.ultimaFalha > this.opcoes.esquecerAposMs) {
      this.registros.delete(chave);
      return undefined;
    }
    return r;
  }

  /** Milissegundos até a próxima tentativa ser permitida (0 = liberada). */
  esperaMs(chave: string, agora = Date.now()): number {
    const r = this.registro(chave, agora);
    return r ? Math.max(0, r.bloqueadoAte - agora) : 0;
  }

  registrarFalha(chave: string, agora = Date.now()): void {
    const { tentativasLivres, bloqueioInicialMs, bloqueioMaximoMs, maxChaves } = this.opcoes;
    const anterior = this.registro(chave, agora);
    const falhas = (anterior?.falhas ?? 0) + 1;
    const excedentes = falhas - tentativasLivres;
    const bloqueio =
      excedentes > 0 ? Math.min(bloqueioMaximoMs, bloqueioInicialMs * 2 ** (excedentes - 1)) : 0;
    this.registros.delete(chave);
    this.registros.set(chave, { falhas, ultimaFalha: agora, bloqueadoAte: agora + bloqueio });
    while (this.registros.size > maxChaves) {
      const maisAntiga = this.registros.keys().next().value;
      if (maisAntiga === undefined) break;
      this.registros.delete(maisAntiga);
    }
  }

  registrarSucesso(chave: string): void {
    this.registros.delete(chave);
  }
}
