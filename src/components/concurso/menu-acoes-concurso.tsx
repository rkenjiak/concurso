"use client";

import { CalendarArrowDown, Ellipsis, Share2, Trash2 } from "lucide-react";
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
import { DialogoCompartilharConcurso } from "./dialogo-compartilhar-concurso";
import { DialogoExcluirConcurso } from "./dialogo-excluir-concurso";

interface MenuAcoesConcursoProps {
  concursoId: number;
  /** "Órgão — cargo", para a confirmação da exclusão e diálogo de compartilhamento. */
  nome: string;
  silenciado: boolean;
  tokenCompartilhamento: string | null;
}

/**
 * Menu "⋯" (Mais ações) do cabeçalho do concurso (#100, D8): compartilhar cronograma (#129),
 * baixar o `.ics`, silenciar as notificações (#65; item marcado quando silenciado, resultado
 * anunciado por aviso fora do menu) e, por último, excluir (com confirmação). Os diálogos ficam
 * fora do menu, com estado controlado: o item some quando o menu fecha e não pode ser o dono do
 * diálogo.
 */
export function MenuAcoesConcurso({
  concursoId,
  nome,
  silenciado,
  tokenCompartilhamento,
}: MenuAcoesConcursoProps) {
  const { avisar } = useAvisos();
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const abrindoDialogo = useRef(false);
  const [compartilhando, setCompartilhando] = useState(false);
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
        <DropdownMenuContent
          align="end"
          // Abrindo um diálogo (Compartilhar ou Excluir), o menu não devolve o foco ao gatilho:
          // isso disputaria o foco com o diálogo que está abrindo.
          onCloseAutoFocus={(e) => {
            if (abrindoDialogo.current) {
              e.preventDefault();
              abrindoDialogo.current = false;
            }
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              abrindoDialogo.current = true;
              setCompartilhando(true);
            }}
          >
            <Share2 aria-hidden />
            Compartilhar…
          </DropdownMenuItem>
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
          <DropdownMenuItem
            variante="destrutivo"
            onSelect={() => {
              abrindoDialogo.current = true;
              setExcluindo(true);
            }}
          >
            <Trash2 aria-hidden />
            Excluir…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogoCompartilharConcurso
        concursoId={concursoId}
        nome={nome}
        token={tokenCompartilhamento}
        aberto={compartilhando}
        aoMudarAberto={setCompartilhando}
        focoAoFechar={() => gatilhoRef.current}
      />
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
