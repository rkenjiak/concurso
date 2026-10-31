"use client";

import { CircleCheck, FileJson, FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONFIRMACAO_IMPORTACAO, TAMANHO_MAX_BACKUP } from "@/lib/schemas/backup";
import type { ResultadoAcao } from "@/server/actions/resultado";
import type { ResumoImportacao } from "@/server/repositories/importacao";

function descreverResumo(r: ResumoImportacao): string {
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  return `Backup importado: ${plural(r.concursos, "concurso", "concursos")}, ${plural(
    r.eventos,
    "evento",
    "eventos",
  )}, ${plural(r.links, "link", "links")} e ${plural(r.resultadosFase, "resultado", "resultados")}.`;
}

/** Exportar (JSON/CSV) e importar backup JSON substituindo todos os dados (RF09). */
export function ExportarImportar() {
  const router = useRouter();
  const idArquivo = useId();
  const idCiente = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ciente, setCiente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function abrirConfirmacao() {
    setMensagem(null);
    if (!arquivo) {
      setErro("Selecione o arquivo de backup (.json).");
      return;
    }
    if (arquivo.size > TAMANHO_MAX_BACKUP) {
      setErro("Arquivo grande demais para um backup deste app.");
      return;
    }
    setErro(null);
    setCiente(false);
    setAberto(true);
  }

  function importar() {
    if (!arquivo || !ciente) return;
    iniciar(async () => {
      const corpo = new FormData();
      corpo.set("arquivo", arquivo);
      corpo.set("confirmacao", CONFIRMACAO_IMPORTACAO);
      let r: ResultadoAcao<ResumoImportacao>;
      try {
        const resposta = await fetch("/api/import", { method: "POST", body: corpo });
        r = await resposta.json();
      } catch {
        r = {
          ok: false,
          erros: { _form: ["Não foi possível enviar o arquivo. Tente novamente."] },
        };
      }
      setAberto(false);
      if (r.ok) {
        setMensagem(descreverResumo(r.data));
        setArquivo(null);
        if (entrada.current) entrada.current.value = "";
        router.refresh();
      } else {
        setErro(r.erros._form?.[0] ?? "Não foi possível importar o backup.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-medium">Exportar</h3>
        <p className="text-muted-foreground text-sm">
          O backup JSON contém todos os dados (concursos, tags, links, eventos, histórico e
          resultados) e pode ser importado depois. O CSV traz só os concursos, para abrir em
          planilhas.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href="/api/export?formato=json" download>
              <FileJson aria-hidden />
              Baixar backup (JSON)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export?formato=csv" download>
              <FileSpreadsheet aria-hidden />
              Baixar concursos (CSV)
            </a>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Importar backup</h3>
        <p className="text-muted-foreground text-sm">
          Restaura um backup JSON exportado por este app.{" "}
          <strong className="text-foreground">Todos os dados atuais são substituídos.</strong>{" "}
          Exporte um backup antes, se quiser guardar o estado atual.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor={idArquivo}>Arquivo de backup (.json)</Label>
            <Input
              ref={entrada}
              id={idArquivo}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] ?? null);
                setErro(null);
                setMensagem(null);
              }}
            />
          </div>
          <Button variant="destructive" onClick={abrirConfirmacao} disabled={pendente}>
            <Upload aria-hidden />
            Importar…
          </Button>
        </div>
        {erro ? (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        ) : null}
        {mensagem ? (
          <p role="status" className="text-sm">
            <CircleCheck className="mr-1 inline size-4 align-text-bottom" aria-hidden />
            {mensagem}
          </p>
        ) : null}
      </section>

      <AlertDialog open={aberto} onOpenChange={(v) => !pendente && setAberto(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os concursos, eventos, links, histórico e resultados atuais serão apagados e
              trocados pelo conteúdo de <strong>{arquivo?.name}</strong>. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Checkbox
              id={idCiente}
              checked={ciente}
              onCheckedChange={(v) => setCiente(v === true)}
            />
            <Label htmlFor={idCiente}>Entendo que os dados atuais serão substituídos</Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={importar} disabled={!ciente || pendente}>
              {pendente ? "Importando…" : "Substituir tudo"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
