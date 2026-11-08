"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useAvisos } from "@/components/avisos/avisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FASE, SITUACAO_FASE, type SituacaoFase } from "@/domain/enums";
import { opcoes, ROTULO_FASE, ROTULO_SITUACAO_FASE } from "@/domain/labels";
import { formatarNota } from "@/lib/format";
import {
  type ResultadoFaseFormValores,
  type ResultadoFaseParaFormulario,
  resultadoFaseSchema,
  VALORES_INICIAIS_RESULTADO_FASE,
  valoresDoResultadoFase,
} from "@/lib/schemas/resultado-fase";
import { cn } from "@/lib/utils";
import { excluirResultadoFase, salvarResultadoFase } from "@/server/actions/resultados";
import { BotaoConfirmar } from "./botao-confirmar";
import { ariaCampo, Campo } from "./campo";

export interface ResultadoFaseItem extends ResultadoFaseParaFormulario {
  id: number;
}

interface ResultadosConcursoProps {
  concursoId: number;
  /** Já na ordem das fases. */
  resultados: readonly ResultadoFaseItem[];
}

const COR_SITUACAO: Readonly<Record<SituacaoFase, string>> = {
  PENDENTE: "",
  APROVADO: "bg-emerald-600 text-white",
  CLASSIFICADO: "bg-sky-600 text-white",
  ELIMINADO: "bg-destructive/10 text-destructive",
  SUB_JUDICE: "bg-aviso/15 text-aviso-foreground",
};

const nomeResultado = (r: Pick<ResultadoFaseItem, "fase" | "descricao">) =>
  r.descricao ? `${ROTULO_FASE[r.fase]} — ${r.descricao}` : ROTULO_FASE[r.fase];

function nota(r: ResultadoFaseItem): string | null {
  if (r.nota === null) return null;
  return r.notaMaxima === null
    ? formatarNota(r.nota)
    : `${formatarNota(r.nota)} / ${formatarNota(r.notaMaxima)}`;
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (valor === null) return null;
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm tabular-nums">{valor}</dd>
    </div>
  );
}

/** Lista e gerencia as notas, classificações e situação por fase (RF05). */
export function ResultadosConcurso({ concursoId, resultados }: ResultadosConcursoProps) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<ResultadoFaseItem | "novo" | null>(null);

  return (
    <div className="space-y-4">
      {resultados.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum resultado registrado. Adicione a nota, a nota de corte e a classificação de cada
          fase (objetiva, discursiva, TAF…).
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {resultados.map((r) => {
            const nome = nomeResultado(r);
            const cotas =
              r.classificacaoCotas === null
                ? null
                : `${r.classificacaoCotas}º${r.listaCotas ? ` (${r.listaCotas})` : ""}`;
            return (
              <li key={r.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{nome}</span>
                    <Badge
                      variant={r.situacao === "PENDENTE" ? "outline" : "default"}
                      className={cn(COR_SITUACAO[r.situacao])}
                    >
                      {ROTULO_SITUACAO_FASE[r.situacao]}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                    <Dado rotulo="Nota" valor={nota(r)} />
                    <Dado
                      rotulo="Nota de corte"
                      valor={r.notaCorte === null ? null : formatarNota(r.notaCorte)}
                    />
                    <Dado
                      rotulo="Classificação geral"
                      valor={r.classificacaoGeral === null ? null : `${r.classificacaoGeral}º`}
                    />
                    <Dado rotulo="Classificação nas cotas" valor={cotas} />
                  </dl>
                  {r.observacao ? (
                    <p className="whitespace-pre-line text-sm">{r.observacao}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar resultado ${nome}`}
                    onClick={() => setEditando(r)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <BotaoConfirmar
                    titulo="Excluir resultado?"
                    descricao={nome}
                    rotuloConfirmar="Excluir"
                    destrutivo
                    variante="ghost"
                    tamanho="icon"
                    rotuloAcessivel={`Excluir resultado ${nome}`}
                    acao={() => excluirResultadoFase(concursoId, r.id)}
                    aoConcluir={() => avisar({ texto: `Resultado “${nome}” excluído.` })}
                  >
                    <Trash2 aria-hidden />
                  </BotaoConfirmar>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="outline" onClick={() => setEditando("novo")}>
        <Plus aria-hidden />
        Adicionar resultado
      </Button>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {editando !== null ? (
            <FormularioResultado
              key={editando === "novo" ? "novo" : editando.id}
              concursoId={concursoId}
              resultado={editando === "novo" ? null : editando}
              aoConcluir={() => {
                avisar({
                  texto: editando === "novo" ? "Resultado adicionado." : "Resultado salvo.",
                });
                setEditando(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FormularioResultadoProps {
  concursoId: number;
  resultado: ResultadoFaseItem | null;
  aoConcluir: () => void;
}

const CAMPOS = [
  "fase",
  "descricao",
  "nota",
  "notaMaxima",
  "notaCorte",
  "classificacaoGeral",
  "classificacaoCotas",
  "listaCotas",
  "situacao",
  "observacao",
] as const satisfies readonly (keyof ResultadoFaseFormValores)[];

function FormularioResultado({ concursoId, resultado, aoConcluir }: FormularioResultadoProps) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resultadoFaseSchema),
    defaultValues: resultado ? valoresDoResultadoFase(resultado) : VALORES_INICIAIS_RESULTADO_FASE,
  });

  const enviar = handleSubmit(() => {
    setErroGeral(null);
    const valores = getValues();
    iniciar(async () => {
      const r = await salvarResultadoFase(concursoId, resultado?.id ?? null, valores);
      if (r.ok) return aoConcluir();
      for (const campo of CAMPOS) {
        const msg = r.erros[campo]?.[0];
        if (msg) setError(campo, { message: msg });
      }
      setErroGeral(r.erros._form?.[0] ?? null);
    });
  });

  const erro = (campo: keyof ResultadoFaseFormValores) => errors[campo]?.message;

  const numero = (campo: "nota" | "notaMaxima" | "notaCorte", rotulo: string) => (
    <Campo id={`resultado-${campo}`} rotulo={rotulo} erro={erro(campo)}>
      <Input
        {...ariaCampo(`resultado-${campo}`, erro(campo))}
        inputMode="decimal"
        autoComplete="off"
        placeholder="Ex.: 72,5"
        {...register(campo)}
      />
    </Campo>
  );

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{resultado ? "Editar resultado" : "Novo resultado"}</DialogTitle>
        <DialogDescription>
          Nota, nota de corte, classificação e situação da fase.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="resultado-fase" rotulo="Fase" obrigatorio erro={erro("fase")}>
          <NativeSelect
            {...ariaCampo("resultado-fase", erro("fase"))}
            className="w-full"
            {...register("fase")}
          >
            {opcoes(FASE, ROTULO_FASE).map((o) => (
              <NativeSelectOption key={o.valor} value={o.valor}>
                {o.rotulo}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Campo>
        <Campo id="resultado-situacao" rotulo="Situação" obrigatorio erro={erro("situacao")}>
          <NativeSelect
            {...ariaCampo("resultado-situacao", erro("situacao"))}
            className="w-full"
            {...register("situacao")}
          >
            {opcoes(SITUACAO_FASE, ROTULO_SITUACAO_FASE).map((o) => (
              <NativeSelectOption key={o.valor} value={o.valor}>
                {o.rotulo}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Campo>
      </div>
      <Campo
        id="resultado-descricao"
        rotulo="Descrição"
        dica="Opcional (ex.: “Discursiva — peça”)."
        erro={erro("descricao")}
      >
        <Input
          {...ariaCampo("resultado-descricao", erro("descricao"), "dica")}
          {...register("descricao")}
        />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        {numero("nota", "Nota")}
        {numero("notaMaxima", "Nota máxima")}
        {numero("notaCorte", "Nota de corte")}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          id="resultado-classificacaoGeral"
          rotulo="Classif. geral"
          erro={erro("classificacaoGeral")}
        >
          <Input
            {...ariaCampo("resultado-classificacaoGeral", erro("classificacaoGeral"))}
            inputMode="numeric"
            autoComplete="off"
            {...register("classificacaoGeral")}
          />
        </Campo>
        <Campo
          id="resultado-classificacaoCotas"
          rotulo="Classif. cotas"
          erro={erro("classificacaoCotas")}
        >
          <Input
            {...ariaCampo("resultado-classificacaoCotas", erro("classificacaoCotas"))}
            inputMode="numeric"
            autoComplete="off"
            {...register("classificacaoCotas")}
          />
        </Campo>
        <Campo id="resultado-listaCotas" rotulo="Lista de cotas" erro={erro("listaCotas")}>
          <Input
            {...ariaCampo("resultado-listaCotas", erro("listaCotas"))}
            placeholder="PcD, PPP…"
            {...register("listaCotas")}
          />
        </Campo>
      </div>
      <Campo id="resultado-observacao" rotulo="Observação" erro={erro("observacao")}>
        <Textarea
          {...ariaCampo("resultado-observacao", erro("observacao"))}
          rows={3}
          {...register("observacao")}
        />
      </Campo>
      {erroGeral ? (
        <p role="alert" className="text-destructive text-sm">
          {erroGeral}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
