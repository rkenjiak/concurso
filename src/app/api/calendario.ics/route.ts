/**
 * `GET /api/calendario.ics?token=…` (RF08, #65): feed de calendário assinável (`webcal://`) no
 * Google Calendar, Apple Calendar etc. Calendários não têm o cookie de sessão, então a rota é
 * pública no `proxy.ts` e se autentica pelo token pessoal do feed (gerado em Configurações; o banco
 * guarda só o SHA-256). O feed é do dono do token, com as opções dele; usuário bloqueado (#50), que
 * perdeu o acesso (mesma regra da sessão, #96) ou token revogado → 404. Falhas seguidas sofrem atraso progressivo, como o login.
 */
import type { NextRequest } from "next/server";
import { chaveCliente } from "@/server/auth/acesso";
import { donoDoTokenAutorizado } from "@/server/auth/autorizacao";
import { lerConfigAuth } from "@/server/auth/config";
import { LimitadorTentativas } from "@/server/auth/limitador";
import { origemPublica } from "@/server/auth/login-google";
import { getDb } from "@/server/db/client";
import { log } from "@/server/log";
import { gerarIcsDoUsuario } from "@/server/queries/calendario-ics";
import { usuarioDoTokenIcs } from "@/server/repositories/usuarios";

const limitador = new LimitadorTentativas();

const texto = (corpo: string, status: number, headers: Record<string, string> = {}) =>
  new Response(corpo, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });

export async function GET(request: NextRequest): Promise<Response> {
  const chave = await chaveCliente();
  const espera = limitador.esperaMs(chave);
  if (espera > 0) {
    return texto("Muitas tentativas. Aguarde.", 429, {
      "Retry-After": String(Math.ceil(espera / 1000)),
    });
  }
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const db = getDb();
  const dono = token === "" ? null : await usuarioDoTokenIcs(db, token);
  const autorizado = dono !== null && (await donoDoTokenAutorizado(db, lerConfigAuth(), dono));
  const usuario = autorizado ? dono : null;
  if (!usuario) {
    log.warn("auth.token_invalido", {
      rota: "ics",
      ip: chave,
      ausente: token === "",
      ...(dono !== null && { usuarioId: dono.id, motivo: "sem_acesso" }),
    });
    // Só token inexistente conta como tentativa: o de quem perdeu o acesso é real (não é força
    // bruta) e um feed antigo consultado sem parar atrasaria outros usuários do mesmo IP.
    const bloqueio = dono === null ? limitador.registrarFalha(chave) : 0;
    if (bloqueio > 0) {
      log.warn("auth.limite_tentativas", { rota: "ics", ip: chave, esperaMs: bloqueio });
    }
    // 404 (e não 401): o calendário não tem como pedir credenciais.
    return texto("Calendário não encontrado. Gere um novo link em Configurações.", 404);
  }
  limitador.registrarSucesso(chave);
  const ics = await gerarIcsDoUsuario(db, usuario.id, {
    incluirConcluidos: usuario.icsIncluirConcluidos,
    incluirEncerrados: usuario.icsIncluirEncerrados,
    urlBase: origemPublica(request),
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="concursos.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
