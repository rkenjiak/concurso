"use client";

import { CalendarArrowDown, Ellipsis, Trash2 } from "lucide-react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { useAvisos } from "@/components/avisos/avisos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { silenciarConcursoAcao } from "@/server/actions/notificacoes";
import { DialogoExcluirConcurso } from "./dialogo-excluir-concurso";

interface MenuAcoesConcursoProps {
  concursoId: number;
  /** "Órgão — cargo", para a confirmação da exclusão. */
  nome: string;
  silenciado: boolean;
}

/**
 * Menu "⋯" (Mais ações) do cabeçalho do concurso (#100, D8): baixar o `.ics`, silenciar as
 * notificações (#65; item marcado quando silenciado, resultado anunciado por aviso fora do menu)
 * e, por último, excluir (com confirmação). A confirmação fica fora do menu, com estado
 * controlado: o item some quando o menu fecha e não pode ser o dono do diálogo.
 */
export function MenuAcoesConcurso({ concursoId, nome, silenciado }: MenuAcoesConcursoProps) {
  const { avisar } = useAvisos();
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [silenciadoOtimista, setSilenciadoOtimista] = useOptimistic(silenciado);
  const [, iniciar] = useTransition();
  const chave = `silenciar-${concursoId}`;

  /** Silencia (ou reativa) as notificações e os alarmes do calendário; os eventos continuam. */
  function definirSilenciado(valor: boolean) {
    return new Promise<void>((resolver) => {
      iniciar(async () => {
        setSilenciadoOtimista(valor);
        const r = await silenciarConcursoAcao(concursoId, valor);
        avisar(
          r.ok
            ? {
                texto: valor
                  ? "Notificações e alarmes deste concurso silenciados."
                  : "Notificações e alarmes deste concurso reativados.",
                chave,
                acao: { rotulo: "Desfazer", executar: () => definirSilenciado(!valor) },
              }
            : {
                texto: r.erros._form?.[0] ?? "Não foi possível atualizar as notificações.",
                tipo: "erro",
                chave,
              },
        );
        resolver();
      });
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={gatilhoRef}
            variant="outline"
            size="icon"
            aria-label="Mais ações"
            className="max-md:size-11"
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a
              href={`/api/export?formato=ics&concurso=${concursoId}`}
              download
              title="Baixar os eventos deste concurso para o calendário"
            >
              <CalendarArrowDown aria-hidden />
              Baixar eventos (.ics)
            </a>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={silenciadoOtimista}
            onCheckedChange={(v) => void definirSilenciado(v === true)}
            title="Os eventos continuam no dashboard, no calendário e no feed .ics"
          >
            Silenciar notificações
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variante="destrutivo" onSelect={() => setExcluindo(true)}>
            <Trash2 aria-hidden />
            Excluir…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogoExcluirConcurso
        id={concursoId}
        nome={nome}
        aberto={excluindo}
        aoMudarAberto={setExcluindo}
        focoAoFechar={() => gatilhoRef.current}
      />
    </>
  );
}
