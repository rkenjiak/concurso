import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BadgeStatus } from "@/components/concurso/badge-status";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROTULO_ESFERA } from "@/domain/labels";
import { formatarBRL } from "@/lib/format";
import { getDb } from "@/server/db/client";
import { listarConcursos } from "@/server/queries/concursos";

export const metadata: Metadata = { title: "Concursos" };

export default async function ConcursosPage() {
  await connection();
  const concursos = await listarConcursos(getDb());

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Concursos"
        descricao="Cadastre e acompanhe seus concursos."
        acoes={
          <Button asChild>
            <Link href="/concursos/novo">
              <Plus aria-hidden />
              Novo concurso
            </Link>
          </Button>
        }
      />
      {concursos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum concurso cadastrado ainda.{" "}
            <Link href="/concursos/novo" className="text-primary underline underline-offset-4">
              Cadastre o primeiro
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {concursos.map((c) => {
            const local = [c.cidade, c.uf].filter(Boolean).join(" / ");
            const detalhes = [
              c.banca,
              c.esfera ? ROTULO_ESFERA[c.esfera] : null,
              local || null,
              c.remuneracaoCentavos != null ? formatarBRL(c.remuneracaoCentavos) : null,
            ].filter(Boolean);
            return (
              <li key={c.id}>
                <Link
                  href={`/concursos/${c.id}`}
                  className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.orgao}</p>
                      <p className="truncate text-muted-foreground text-sm">{c.cargo}</p>
                    </div>
                    <BadgeStatus status={c.status} />
                  </div>
                  {detalhes.length > 0 ? (
                    <p className="mt-2 text-muted-foreground text-xs">{detalhes.join(" · ")}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
