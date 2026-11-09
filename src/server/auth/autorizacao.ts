/**
 * Quem pode entrar e continuar usando o app (#49, #50) — ARQUITETURA.md §7.1. Sem dependências
 * do Next: usado por `acesso.ts`, pelo callback do login Google e por testes.
 *
 * Login Google: entra quem não está bloqueado e (a) tem o e-mail em `ADMIN_EMAILS` ou
 * `ALLOWED_EMAILS`, (b) tem o e-mail liberado no painel admin (tabela `email_permitido`) ou
 * (c) já é admin no banco (o papel dá acesso, então rebaixar é a forma de tirar um admin).
 * A mesma regra é conferida a cada requisição, então mudanças valem na hora.
 */
import type { MotivoSemAcesso, OrigemAcesso } from "@/domain/enums";
import { ID_USUARIO_INICIAL, type Usuario } from "../db/schema";
import type { Executor } from "../repositories/tipos";
import { buscarUsuarioGoogle, emailNaAllowlist, obterUsuario } from "../repositories/usuarios";
import { type ConfigAuth, emailPermitido, normalizarEmail } from "./config";
import type { DadosSessao } from "./sessao";

type ConfigHabilitada = Extract<ConfigAuth, { habilitada: true }>;

/** `true` se o e-mail pode entrar com Google pelas variáveis de ambiente ou pelo painel. */
export async function emailAutorizado(
  db: Executor,
  config: Pick<ConfigHabilitada, "emailsAdmin" | "emailsPermitidos">,
  email: string,
): Promise<boolean> {
  return emailPermitido(config, email) || emailNaAllowlist(db, normalizarEmail(email));
}

/** `true` se o usuário (com login Google) pode usar o app agora. */
export async function contaGoogleAutorizada(
  db: Executor,
  config: Pick<ConfigHabilitada, "emailsAdmin" | "emailsPermitidos">,
  u: Pick<Usuario, "email" | "papel" | "bloqueadoEm">,
): Promise<boolean> {
  if (u.bloqueadoEm !== null || u.email === null) return false;
  return u.papel === "ADMIN" || emailAutorizado(db, config, u.email);
}

export type DecisaoLoginGoogle = "ok" | "nao_autorizado" | "bloqueado";

/** Decide o login Google de um perfil já validado (antes de criar/atualizar o usuário). */
export async function decidirLoginGoogle(
  db: Executor,
  config: Pick<ConfigHabilitada, "emailsAdmin" | "emailsPermitidos">,
  perfil: { sub: string; email: string },
): Promise<DecisaoLoginGoogle> {
  const existente = await buscarUsuarioGoogle(db, perfil.sub, perfil.email);
  if (existente?.bloqueadoEm != null) return "bloqueado";
  if (existente?.papel === "ADMIN" || (await emailAutorizado(db, config, perfil.email))) {
    return "ok";
  }
  return "nao_autorizado";
}

/**
 * Usuário de uma requisição, ou `null` se a sessão não vale mais. Sem login configurado é sempre
 * o usuário inicial (uso local; o bloqueio não se aplica). Com login, a sessão só vale enquanto o
 * método usado continuar permitido e o usuário não estiver bloqueado: login por senha com
 * `APP_PASSWORD` ainda definido (sempre como usuário inicial); login Google com a conta ainda
 * autorizada ({@link contaGoogleAutorizada}).
 */
export async function usuarioDaSessao(
  db: Executor,
  config: ConfigAuth,
  sessao: DadosSessao | null,
): Promise<Usuario | null> {
  if (!config.habilitada) {
    const u = await obterUsuario(db, ID_USUARIO_INICIAL);
    if (!u) throw new Error("Usuário inicial ausente: aplique as migrações.");
    return u;
  }
  if (!sessao) return null;
  if (sessao.metodo === "senha") {
    if (config.senha === null || sessao.usuarioId !== ID_USUARIO_INICIAL) return null;
  } else if (config.google === null) {
    return null;
  }
  const u = await obterUsuario(db, sessao.usuarioId);
  if (!u || u.bloqueadoEm !== null) return null;
  if (sessao.metodo === "google" && !(await contaGoogleAutorizada(db, config, u))) return null;
  return u;
}

/**
 * `true` se o dono de um token pessoal (MCP ou feed .ics) ainda pode usar o app — a mesma regra da
 * sessão web ({@link usuarioDaSessao}), conferida a cada requisição (#96). Assim, tirar o e-mail
 * da allowlist (painel ou `ALLOWED_EMAILS`), desligar o método de login ou bloquear a conta também
 * invalida os tokens na hora, sem precisar revogá-los. Como o token não guarda o método de login,
 * vale o que der acesso hoje: o usuário inicial entra pela senha (`APP_PASSWORD` definido) ou,
 * sem login configurado, sempre; os demais só com a conta Google autorizada.
 */
export async function donoDoTokenAutorizado(
  db: Executor,
  config: ConfigAuth,
  u: Pick<Usuario, "id" | "email" | "papel" | "bloqueadoEm">,
): Promise<boolean> {
  if (u.bloqueadoEm !== null) return false;
  if (u.id === ID_USUARIO_INICIAL && (!config.habilitada || config.senha !== null)) return true;
  return config.habilitada && config.google !== null && contaGoogleAutorizada(db, config, u);
}

/** Acesso de um usuário hoje (#108): o que lhe dá acesso e, se nada der, o motivo. */
export interface AcessoHoje {
  origens: OrigemAcesso[];
  temAcesso: boolean;
  motivo: MotivoSemAcesso | null;
}

/**
 * Versão síncrona e explicada de {@link donoDoTokenAutorizado} para o painel admin (#108): recebe
 * se o e-mail está liberado no painel (`emailNoPainel`, vindo de um `LEFT JOIN` na listagem, sem
 * N+1) e lista cada origem que dá acesso hoje. As origens do Google só valem com o login Google
 * ligado; a do usuário inicial, com a senha definida ou sem login configurado.
 */
export function acessoHoje(
  config: ConfigAuth,
  u: Pick<Usuario, "id" | "email" | "papel" | "bloqueadoEm"> & { emailNoPainel: boolean },
): AcessoHoje {
  const origens: OrigemAcesso[] = [];
  if (u.id === ID_USUARIO_INICIAL && (!config.habilitada || config.senha !== null)) {
    origens.push("USUARIO_INICIAL");
  }
  const google = config.habilitada && config.google !== null;
  if (google && u.email !== null) {
    const e = normalizarEmail(u.email);
    if (config.emailsAdmin.has(e)) origens.push("ADMIN_EMAILS");
    if (config.emailsPermitidos.has(e)) origens.push("ALLOWED_EMAILS");
    if (u.emailNoPainel) origens.push("PAINEL");
    if (u.papel === "ADMIN") origens.push("PAPEL_ADMIN");
  }
  const motivo: MotivoSemAcesso | null =
    u.bloqueadoEm !== null
      ? "BLOQUEADO"
      : origens.length > 0
        ? null
        : google
          ? "FORA_DAS_LISTAS"
          : "LOGIN_GOOGLE_DESLIGADO";
  return { origens, temAcesso: motivo === null, motivo };
}
