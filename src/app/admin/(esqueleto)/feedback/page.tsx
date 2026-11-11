import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CaixaFeedback } from "@/components/admin/caixa-feedback";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TIPO_FEEDBACK } from "@/domain/enums";
import { opcoes, ROTULO_TIPO_FEEDBACK } from "@/domain/labels";
import {
  type FiltroStatusFeedback,
  hrefFeedback,
  lerFiltrosFeedback,
} from "@/lib/schemas/feedback";
import { cn } from "@/lib/utils";
import { exigirAdminPagina } from "@/server/auth/admin";
import { getDb } from "@/server/db/client";
import { contarFeedbacksNovos, listarFeedbacks } from "@/server/repositories/feedback";

export const metadata: Metadata = { title: "Feedback" };

const ABAS: { status: FiltroStatusFeedback; rotulo: string }[] = [
  { status: "NOVO", rotulo: "Novos" },
  { status: "EXPORTADO", rotulo: "Exportados" },
  { status: "DESCARTADO", rotulo: "Descartados" },
  { status: "TODOS", rotulo: "Todos" },
];

/**
 * Caixa de entrada de feedback (#117): filtros por status (abas), tipo e texto, paginação e, na
 * lista, seleção em massa para exportar, descartar, restaurar ou excluir.
 */
export default async function FeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  await connection();
  await exigirAdminPagina();
  const filtros = lerFiltrosFeedback(await searchParams);
  const db = getDb();
  const [lista, novos] = await Promise.all([
    listarFeedbacks(db, filtros),
    contarFeedbacksNovos(db),
  ]);
  const { pagina, totalPaginas, total } = lista;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Feedback"
        descricao="O que os usuários enviaram pelo menu da conta. Selecione vários para exportar como issue ou descartar."
      />
      <nav aria-label="Status do feedback">
        <ul className="flex flex-wrap gap-2">
          {ABAS.map((aba) => {
            const atual = aba.status === filtros.status;
            return (
              <li key={aba.status}>
                <Link
                  href={hrefFeedback({ ...filtros, status: aba.status, pagina: 1 })}
                  aria-current={atual ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 pointer-coarse:h-11 pointer-coarse:px-4",
                    atual ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
                  )}
                >
                  {aba.rotulo}
                  {aba.status === "NOVO" ? ` (${novos})` : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* GET comum: funciona sem JavaScript e mantém a aba. */}
      <search aria-label="Filtrar feedback">
        <form action="/admin/feedback" className="flex flex-wrap items-end gap-2">
          {filtros.status !== "NOVO" ? (
            <input type="hidden" name="status" value={filtros.status.toLowerCase()} />
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="feedback-tipo">Tipo</Label>
            <NativeSelect
              id="feedback-tipo"
              name="tipo"
              defaultValue={filtros.tipo?.toLowerCase() ?? ""}
            >
              <NativeSelectOption value="">Todos</NativeSelectOption>
              {opcoes(TIPO_FEEDBACK, ROTULO_TIPO_FEEDBACK).map((o) => (
                <NativeSelectOption key={o.valor} value={o.valor.toLowerCase()}>
                  {o.rotulo}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid min-w-48 flex-1 gap-1.5">
            <Label htmlFor="feedback-busca">Buscar na mensagem</Label>
            <Input id="feedback-busca" name="busca" type="search" defaultValue={filtros.busca} />
          </div>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
      </search>
      <Card>
        <CardContent>
          {/* Remonta a cada lista: a seleção não sobrevive à troca de filtro ou página. */}
          <CaixaFeedback
            key={hrefFeedback(filtros)}
            // Só os campos que a lista e o export usam.
            itens={lista.itens.map((f) => ({
              id: f.id,
              tipo: f.tipo,
              mensagem: f.mensagem,
              pagina: f.pagina,
              versaoApp: f.versaoApp,
              commitApp: f.commitApp,
              userAgent: f.userAgent,
              usuario: f.usuario,
              status: f.status,
              createdAt: f.createdAt,
            }))}
            status={filtros.status}
          />
        </CardContent>
      </Card>
      {totalPaginas > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Página {pagina} de {totalPaginas} · {total} feedbacks
          </span>
          <span className="flex gap-2">
            {pagina > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={hrefFeedback({ ...filtros, pagina: pagina - 1 })}>Anterior</Link>
              </Button>
            ) : null}
            {pagina < totalPaginas ? (
              <Button asChild variant="outline" size="sm">
                <Link href={hrefFeedback({ ...filtros, pagina: pagina + 1 })}>Próxima</Link>
              </Button>
            ) : null}
          </span>
        </nav>
      ) : null}
    </div>
  );
}
