"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ESCOLARIDADE, ESFERA, STATUS, UF } from "@/domain/enums";
import { opcoes, ROTULO_ESCOLARIDADE, ROTULO_ESFERA, ROTULO_STATUS } from "@/domain/labels";
import { centavosParaEntrada } from "@/lib/format";
import {
  contarFiltrosAvancados,
  FILTROS_VAZIOS,
  type FiltrosConcursos,
  filtrosParaBusca,
  lerFiltrosConcursos,
  ORDENACOES,
  PARAMS,
  parametrosDeEntradas,
  ROTULO_ORDENACAO,
  temFiltros,
} from "@/lib/schemas/filtros-concursos";
import { CampoMoeda } from "./campo-moeda";

const CAMINHO = "/concursos";

/**
 * Busca, filtros e ordenação da lista (RF07). Sem JavaScript é um formulário GET comum; com JS,
 * navega para a URL canônica (sem parâmetros vazios). Remonte com `key` a cada mudança de URL
 * para sincronizar os campos.
 */
export function FiltrosConcursosForm({ filtros }: { filtros: FiltrosConcursos }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [remMin, setRemMin] = useState(centavosParaEntrada(filtros.remuneracaoMin));
  const [remMax, setRemMax] = useState(centavosParaEntrada(filtros.remuneracaoMax));
  const avancados = contarFiltrosAvancados(filtros);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const novos = lerFiltrosConcursos(parametrosDeEntradas(dados.entries()));
    iniciar(() => router.push(`${CAMINHO}${filtrosParaBusca(novos)}`));
  }

  return (
    <search aria-label="Buscar e filtrar concursos">
      <form
        action={CAMINHO}
        method="get"
        onSubmit={enviar}
        aria-busy={pendente}
        className="space-y-3"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              name={PARAMS.busca}
              defaultValue={filtros.busca ?? ""}
              placeholder="Buscar por órgão, cargo, banca ou tag"
              aria-label="Buscar por órgão, cargo, banca ou tag"
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <NativeSelect
              name={PARAMS.ordem}
              defaultValue={filtros.ordem}
              aria-label="Ordenar por"
              className="flex-1 sm:w-52 sm:flex-none"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              {ORDENACOES.map((o) => (
                <NativeSelectOption key={o} value={o}>
                  {ROTULO_ORDENACAO[o]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="submit" disabled={pendente}>
              <Search aria-hidden />
              Buscar
            </Button>
          </div>
        </div>

        <details open={avancados > 0} className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-sm [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {avancados > 0 ? <Badge variant="secondary">{avancados}</Badge> : null}
          </summary>
          <div className="space-y-4 border-t p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Filtro id="filtro-esfera" rotulo="Esfera">
                <NativeSelect
                  id="filtro-esfera"
                  name={PARAMS.esfera}
                  defaultValue={filtros.esfera ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">Todas</NativeSelectOption>
                  {opcoes(ESFERA, ROTULO_ESFERA).map((o) => (
                    <NativeSelectOption key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Filtro>
              <Filtro id="filtro-uf" rotulo="UF">
                <NativeSelect
                  id="filtro-uf"
                  name={PARAMS.uf}
                  defaultValue={filtros.uf ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">Todas</NativeSelectOption>
                  {UF.map((uf) => (
                    <NativeSelectOption key={uf} value={uf}>
                      {uf}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Filtro>
              <Filtro id="filtro-escolaridade" rotulo="Escolaridade">
                <NativeSelect
                  id="filtro-escolaridade"
                  name={PARAMS.escolaridade}
                  defaultValue={filtros.escolaridade ?? ""}
                  className="w-full"
                >
                  <NativeSelectOption value="">Todas</NativeSelectOption>
                  {opcoes(ESCOLARIDADE, ROTULO_ESCOLARIDADE).map((o) => (
                    <NativeSelectOption key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Filtro>
              <Filtro id="filtro-rem-min" rotulo="Remuneração mínima">
                <CampoMoeda
                  id="filtro-rem-min"
                  name={PARAMS.remuneracaoMin}
                  value={remMin}
                  onChange={setRemMin}
                />
              </Filtro>
              <Filtro id="filtro-rem-max" rotulo="Remuneração máxima">
                <CampoMoeda
                  id="filtro-rem-max"
                  name={PARAMS.remuneracaoMax}
                  value={remMax}
                  onChange={setRemMax}
                />
              </Filtro>
            </div>
            <fieldset className="space-y-2">
              <legend className="font-medium text-sm">Status</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {STATUS.map((s) => (
                  <label key={s} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name={PARAMS.status}
                      value={s}
                      defaultChecked={filtros.status.includes(s)}
                      className="size-4 accent-primary"
                    />
                    {ROTULO_STATUS[s]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" disabled={pendente}>
                Aplicar filtros
              </Button>
            </div>
          </div>
        </details>

        {temFiltros(filtros) ? (
          <Button asChild variant="ghost" size="sm">
            <Link
              href={`${CAMINHO}${filtrosParaBusca({ ...FILTROS_VAZIOS, ordem: filtros.ordem })}`}
            >
              <X aria-hidden />
              Limpar filtros
            </Link>
          </Button>
        ) : null}
      </form>
    </search>
  );
}

function Filtro({
  id,
  rotulo,
  children,
}: {
  id: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children}
    </div>
  );
}
