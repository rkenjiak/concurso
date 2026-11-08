"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useFocoNoErro } from "@/components/formulario/use-foco-no-erro";
import { useProtecaoSaida } from "@/components/formulario/use-protecao-saida";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { corPadrao, ehCorConcurso, SUGESTOES_ICONE } from "@/domain/cores";
import { ESCOLARIDADE, ESFERA, STATUS, UF } from "@/domain/enums";
import {
  opcoes,
  ROTULO_ESCOLARIDADE,
  ROTULO_ESFERA,
  ROTULO_STATUS,
  ROTULO_UF,
} from "@/domain/labels";
import { VALIDADE_MESES_MAX, VALIDADE_MESES_MIN } from "@/domain/validade";
import { MUDAR_STATUS, PARAM_MUDAR } from "@/lib/aba-concurso";
import { CAMPOS_CONCURSO, type ConcursoFormValores, concursoSchema } from "@/lib/schemas/concurso";
import { atualizarConcurso, criarConcurso } from "@/server/actions/concursos";
import { ariaCampo, Campo } from "./campo";
import { CampoCorConcurso } from "./campo-cor-concurso";
import { CampoMoeda } from "./campo-moeda";
import { CampoTags } from "./campo-tags";
import { MarcadorConcurso } from "./marcador-concurso";

interface FormularioConcursoProps {
  valoresIniciais: ConcursoFormValores;
  /** Ausente = criação; presente = edição do concurso com esse ID. */
  concursoId?: number;
  /** Tags existentes para sugestão. */
  tagsExistentes?: readonly string[];
}

const CAMPOS = new Set<string>(CAMPOS_CONCURSO);

export function FormularioConcurso({
  valoresIniciais,
  concursoId,
  tagsExistentes = [],
}: FormularioConcursoProps) {
  const router = useRouter();
  const editando = concursoId !== undefined;
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(concursoSchema),
    defaultValues: valoresIniciais,
    // O foco no erro é do `useFocoNoErro` (vale também para os erros do servidor).
    shouldFocusError: false,
  });
  const { formRef, erroGeralRef, focarErro } = useFocoNoErro();
  // Enviando, não bloqueia: em caso de sucesso a action redireciona (#100, D10).
  const protecao = useProtecaoSaida(isDirty && !enviando);

  const erro = (campo: keyof ConcursoFormValores) => errors[campo]?.message;
  const corAutomatica = editando ? corPadrao(concursoId) : undefined;
  const [corEscolhida, iconeAtual] = useWatch({ control, name: ["cor", "icone"] });
  const corPrevia = ehCorConcurso(corEscolhida) ? corEscolhida : corAutomatica;

  const enviar = handleSubmit(
    () => {
      setErroGeral(null);
      // Envia os valores crus: o servidor valida de novo com o mesmo schema.
      const valores = getValues();
      iniciarEnvio(async () => {
        const r = editando
          ? await atualizarConcurso(concursoId, valores)
          : await criarConcurso(valores);
        // Em caso de sucesso a action redireciona para o detalhe na própria resposta (#73).
        if (r.ok) return;
        let erroDeCampo = false;
        for (const [campo, mensagens] of Object.entries(r.erros)) {
          if (CAMPOS.has(campo) && mensagens?.[0]) {
            setError(campo as keyof ConcursoFormValores, { message: mensagens[0] });
            erroDeCampo = true;
          }
        }
        setErroGeral(r.erros._form?.[0] ?? "Verifique os campos destacados.");
        focarErro(erroDeCampo);
      });
    },
    () => {
      setErroGeral("Verifique os campos destacados.");
      focarErro(true);
    },
  );

  return (
    <>
      <form ref={formRef} onSubmit={enviar} noValidate className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="orgao" rotulo="Nome / órgão" obrigatorio erro={erro("orgao")}>
              <Input
                {...ariaCampo("orgao", erro("orgao"))}
                placeholder="Ex.: TRF 3ª Região"
                {...register("orgao")}
              />
            </Campo>
            <Campo id="cargo" rotulo="Cargo(s) / área" obrigatorio erro={erro("cargo")}>
              <Input
                {...ariaCampo("cargo", erro("cargo"))}
                placeholder="Ex.: Analista Judiciário"
                {...register("cargo")}
              />
            </Campo>
            <Campo id="banca" rotulo="Banca organizadora" erro={erro("banca")}>
              <Input
                {...ariaCampo("banca", erro("banca"))}
                placeholder="Ex.: FCC, Cebraspe, FGV"
                {...register("banca")}
              />
            </Campo>
            {editando ? (
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <p className="text-muted-foreground text-sm">
                  {ROTULO_STATUS[valoresIniciais.status as keyof typeof ROTULO_STATUS]} —{" "}
                  {/* Abre o "Mudar status" do cabeçalho (#100, D7). */}
                  <Link
                    href={`/concursos/${concursoId}?${PARAM_MUDAR}=${MUDAR_STATUS}`}
                    className="text-foreground underline underline-offset-3 hover:text-primary"
                  >
                    altere na página do concurso
                  </Link>{" "}
                  para registrar no histórico.
                </p>
              </div>
            ) : (
              <Campo id="status" rotulo="Status" obrigatorio erro={erro("status")}>
                <NativeSelect
                  {...ariaCampo("status", erro("status"))}
                  className="w-full"
                  {...register("status")}
                >
                  {opcoes(STATUS, ROTULO_STATUS).map((o) => (
                    <NativeSelectOption key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Campo>
            )}
            <Campo
              id="tags"
              rotulo="Tags"
              dica="Ex.: prioridade, tribunais. Reaproveite tags existentes pelas sugestões."
              erro={erro("tags")}
              className="sm:col-span-2"
            >
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <CampoTags
                    {...ariaCampo("tags", erro("tags"), "dica")}
                    value={field.value}
                    onChange={field.onChange}
                    sugestoes={tagsExistentes}
                  />
                )}
              />
            </Campo>
            <CampoCorConcurso
              registro={register("cor")}
              corAutomatica={corAutomatica}
              erro={erro("cor")}
            />
            <Campo
              id="icone"
              rotulo="Ícone (opcional)"
              dica="Um emoji exibido junto da cor. Deixe vazio para não usar."
              erro={erro("icone")}
            >
              <div className="flex items-center gap-2">
                <Input
                  {...ariaCampo("icone", erro("icone"), "dica")}
                  className="w-24"
                  autoComplete="off"
                  placeholder="Ex.: ⚖️"
                  {...register("icone")}
                />
                {corPrevia ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
                    Prévia:
                    <MarcadorConcurso cor={corPrevia} icone={iconeAtual?.trim() || null} rotulado />
                  </span>
                ) : null}
              </div>
            </Campo>
            <fieldset className="grid gap-1.5">
              <legend className="mb-1.5 font-medium text-sm leading-none">
                Sugestões de ícone
              </legend>
              <div className="flex flex-wrap gap-1">
                {SUGESTOES_ICONE.map((sugestao) => (
                  <Button
                    key={sugestao}
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Usar ${sugestao} como ícone`}
                    onClick={() =>
                      setValue("icone", sugestao, { shouldDirty: true, shouldValidate: true })
                    }
                  >
                    {sugestao}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setValue("icone", "", { shouldDirty: true, shouldValidate: true })}
                >
                  Sem ícone
                </Button>
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local e requisitos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="esfera" rotulo="Esfera" erro={erro("esfera")}>
              <NativeSelect
                {...ariaCampo("esfera", erro("esfera"))}
                className="w-full"
                {...register("esfera")}
              >
                <NativeSelectOption value="">Não informada</NativeSelectOption>
                {opcoes(ESFERA, ROTULO_ESFERA).map((o) => (
                  <NativeSelectOption key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Campo>
            <Campo id="escolaridade" rotulo="Escolaridade exigida" erro={erro("escolaridade")}>
              <NativeSelect
                {...ariaCampo("escolaridade", erro("escolaridade"))}
                className="w-full"
                {...register("escolaridade")}
              >
                <NativeSelectOption value="">Não informada</NativeSelectOption>
                {opcoes(ESCOLARIDADE, ROTULO_ESCOLARIDADE).map((o) => (
                  <NativeSelectOption key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Campo>
            <Campo id="uf" rotulo="UF" erro={erro("uf")}>
              <NativeSelect {...ariaCampo("uf", erro("uf"))} className="w-full" {...register("uf")}>
                <NativeSelectOption value="">Não informada</NativeSelectOption>
                {UF.map((uf) => (
                  <NativeSelectOption key={uf} value={uf}>
                    {uf} — {ROTULO_UF[uf]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Campo>
            <Campo id="cidade" rotulo="Cidade" erro={erro("cidade")}>
              <Input {...ariaCampo("cidade", erro("cidade"))} {...register("cidade")} />
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valores e vagas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="remuneracao" rotulo="Remuneração inicial" erro={erro("remuneracao")}>
              <Controller
                control={control}
                name="remuneracao"
                render={({ field }) => (
                  <CampoMoeda
                    {...ariaCampo("remuneracao", erro("remuneracao"))}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Campo>
            <Campo id="taxaInscricao" rotulo="Taxa de inscrição" erro={erro("taxaInscricao")}>
              <Controller
                control={control}
                name="taxaInscricao"
                render={({ field }) => (
                  <CampoMoeda
                    {...ariaCampo("taxaInscricao", erro("taxaInscricao"))}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Campo>
            <Campo id="vagasAmpla" rotulo="Vagas (ampla concorrência)" erro={erro("vagasAmpla")}>
              <Input
                {...ariaCampo("vagasAmpla", erro("vagasAmpla"))}
                inputMode="numeric"
                {...register("vagasAmpla")}
              />
            </Campo>
            <Campo
              id="vagasCotas"
              rotulo="Vagas para cotas"
              dica="Total PcD, PPP etc. (detalhe nas observações)."
              erro={erro("vagasCotas")}
            >
              <Input
                {...ariaCampo("vagasCotas", erro("vagasCotas"), "dica")}
                inputMode="numeric"
                {...register("vagasCotas")}
              />
            </Campo>
            <Campo
              id="vagasCadastroReserva"
              rotulo="Vagas de cadastro de reserva"
              erro={erro("vagasCadastroReserva")}
            >
              <Input
                {...ariaCampo("vagasCadastroReserva", erro("vagasCadastroReserva"))}
                inputMode="numeric"
                {...register("vagasCadastroReserva")}
              />
            </Campo>
            <div className="flex items-center gap-2 sm:pt-6">
              <Controller
                control={control}
                name="possuiCadastroReserva"
                render={({ field }) => (
                  <Checkbox
                    id="possuiCadastroReserva"
                    ref={field.ref}
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                )}
              />
              <Label htmlFor="possuiCadastroReserva">Possui cadastro de reserva</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validade do concurso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo id="homologacaoData" rotulo="Data da homologação" erro={erro("homologacaoData")}>
              <Input
                {...ariaCampo("homologacaoData", erro("homologacaoData"))}
                type="date"
                {...register("homologacaoData")}
              />
            </Campo>
            <Campo
              id="validadeMeses"
              rotulo="Validade (meses)"
              dica={`De ${VALIDADE_MESES_MIN} a ${VALIDADE_MESES_MAX} meses, conforme o edital.`}
              erro={erro("validadeMeses")}
            >
              <Input
                {...ariaCampo("validadeMeses", erro("validadeMeses"), "dica")}
                inputMode="numeric"
                placeholder="Ex.: 24"
                {...register("validadeMeses")}
              />
            </Campo>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Controller
                control={control}
                name="validadeProrrogada"
                render={({ field }) => (
                  <Checkbox
                    id="validadeProrrogada"
                    ref={field.ref}
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                )}
              />
              <Label htmlFor="validadeProrrogada">Validade prorrogada (por igual período)</Label>
            </div>
            <Campo
              id="validadeFimManual"
              rotulo="Fim da validade (manual)"
              dica="Opcional: substitui o cálculo se o edital dispuser diferente."
              erro={erro("validadeFimManual")}
            >
              <Input
                {...ariaCampo("validadeFimManual", erro("validadeFimManual"), "dica")}
                type="date"
                {...register("validadeFimManual")}
              />
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Campo
              id="observacoes"
              rotulo="Observações gerais"
              dica="Aceita markdown: **negrito**, listas com -, [links](https://…) e tabelas (| a | b |)."
              erro={erro("observacoes")}
            >
              <Textarea
                {...ariaCampo("observacoes", erro("observacoes"), "dica")}
                rows={6}
                {...register("observacoes")}
              />
            </Campo>
          </CardContent>
        </Card>

        {/* Perto dos botões: no formulário longo, o erro de um campo pode estar fora da tela. */}
        {erroGeral ? (
          <p
            ref={erroGeralRef}
            role="alert"
            tabIndex={-1}
            className="text-destructive text-sm outline-none"
          >
            {erroGeral}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* Rota fixa, não `router.back()` (#100): quem chegou por link direto ou recarregou
            não sai do app nem cai numa tela inesperada. */}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              protecao.sair(() => router.push(editando ? `/concursos/${concursoId}` : "/concursos"))
            }
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar concurso"}
          </Button>
        </div>
      </form>
      {protecao.dialogo}
    </>
  );
}
