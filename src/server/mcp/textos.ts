/**
 * Textos do servidor MCP: instruções gerais, guias dos prompts e a referência dos enums (com os
 * rótulos em pt-BR de `domain/labels`), que ajuda a LLM a mapear o texto do edital.
 */
import {
  ESCOLARIDADE,
  ESFERA,
  FASE,
  SITUACAO_FASE,
  STATUS,
  TIPO_EVENTO,
  TIPO_LINK,
} from "@/domain/enums";
import {
  DESCRICAO_STATUS,
  ROTULO_ESCOLARIDADE,
  ROTULO_ESFERA,
  ROTULO_FASE,
  ROTULO_SITUACAO_FASE,
  ROTULO_STATUS,
  ROTULO_TIPO_EVENTO,
  ROTULO_TIPO_LINK,
} from "@/domain/labels";
import { transicoesPermitidas } from "@/domain/status";

export const INSTRUCOES = `Servidor do app "concurso": controle pessoal de concursos públicos (um usuário).

- Um concurso cadastrado corresponde a UM cargo de um edital. Se o edital tiver vários cargos e o
  usuário não disser qual quer, liste os cargos e pergunte antes de cadastrar.
- Preencha somente o que o edital diz para aquele cargo; deixe vazio o que não encontrar — nunca
  invente. Datas em AAAA-MM-DD e horas em HH:mm (horário de Brasília); valores em reais.
- Antes de gravar, mostre um resumo ao usuário (cadastrar_concurso com simular: true ajuda) e
  peça confirmação.
- Não há ferramentas de exclusão: excluir concursos, eventos, links ou resultados é só pela
  interface do app.
- Os valores aceitos em cada campo estão no recurso concurso://referencia.`;

export function guiaCadastro(cargo?: string): string {
  const escolha = cargo?.trim()
    ? `O usuário escolheu o cargo: "${cargo.trim()}". Extraia apenas as informações desse cargo.`
    : "Pergunte ao usuário qual cargo do edital ele quer cadastrar (liste os cargos, com vagas e " +
      "remuneração, se forem vários) e extraia apenas as informações desse cargo.";
  return `Vou te passar o edital de um concurso (anexo ou texto). Cadastre-o no app "concurso".

${escolha}

Passos:
1. Leia o edital inteiro (e retificações, se houver) e identifique o cargo.
2. Extraia, para esse cargo: órgão por extenso, banca, esfera, UF/cidade, escolaridade exigida,
   remuneração inicial e taxa de inscrição (em reais), vagas de ampla concorrência, vagas
   reservadas (soma das cotas) e cadastro de reserva.
3. Monte o cronograma como eventos: publicação do edital, início e fim das inscrições, pedido de
   isenção, vencimento do boleto, provas (objetiva, discursiva, outras fases), gabarito
   preliminar, prazos de recurso e resultado final — com hora e local quando informados. Para
   períodos, use eventos separados de início e fim quando houver tipos para isso; senão, a data
   final com o período na observação.
4. Links: o edital de abertura (EDITAL_ABERTURA), a página da banca (PAGINA_BANCA) e a área do
   candidato, se tiver as URLs.
5. Em observacoes (Markdown), resuma requisitos, atribuições, jornada, lotação, etapas e pesos,
   conteúdo programático por disciplina (resumido) e critérios de desempate, citando os itens do
   edital.
6. Use verificar_duplicado; se já houver o concurso, ofereça atualizá-lo em vez de cadastrar.
7. Chame cadastrar_concurso com simular: true, mostre o resumo ao usuário (destacando o que não
   foi encontrado) e, após a confirmação, chame de novo sem simular.

Não invente valores: o que não estiver no edital fica vazio.`;
}

export function guiaRetificacao(concursoId: number): string {
  return `Vou te passar uma retificação (ou novo comunicado) do concurso #${concursoId} do app
"concurso". Aplique as mudanças.

1. Leia o concurso atual com obter_concurso (id ${concursoId}).
2. Leia a retificação e liste as diferenças em relação ao cadastrado: datas de eventos, vagas,
   remuneração, taxa, requisitos etc. Considere apenas o cargo cadastrado.
3. Mostre as diferenças ao usuário (antes → depois) e peça confirmação.
4. Aplique: eventos com salvar_eventos (com o id para alterar um evento existente — não crie
   duplicado; sem id só para eventos realmente novos), dados do concurso com atualizar_concurso,
   e registre o link da retificação com salvar_links (tipo RETIFICACAO).
5. Eventos cancelados não podem ser excluídos por aqui: ajuste a observação (ex.: "Cancelado
   pela Retificação nº 2") e avise o usuário para excluí-lo pela interface, se quiser.`;
}

function tabela<T extends string>(
  valores: readonly T[],
  rotulos: Readonly<Record<T, string>>,
  extra?: (v: T) => string,
): string {
  return valores.map((v) => `- \`${v}\`: ${rotulos[v]}${extra ? ` — ${extra(v)}` : ""}`).join("\n");
}

/** Referência dos valores aceitos (Markdown). */
export function referencia(): string {
  const transicoes = (s: (typeof STATUS)[number]) => {
    const destinos = transicoesPermitidas(s);
    return `${DESCRICAO_STATUS[s]} Pode ir para: ${destinos.join(", ") || "—"}.`;
  };
  return `# Referência do app "concurso"

Datas: AAAA-MM-DD; horas: HH:mm (horário de Brasília); dinheiro: reais (número).

## Status (pipeline)
${tabela(STATUS, ROTULO_STATUS, transicoes)}

## Esfera
${tabela(ESFERA, ROTULO_ESFERA)}

## Escolaridade
${tabela(ESCOLARIDADE, ROTULO_ESCOLARIDADE)}

## Tipos de evento
${tabela(TIPO_EVENTO, ROTULO_TIPO_EVENTO)}

## Tipos de link
${tabela(TIPO_LINK, ROTULO_TIPO_LINK)}

## Fases (resultados)
${tabela(FASE, ROTULO_FASE)}

## Situação na fase
${tabela(SITUACAO_FASE, ROTULO_SITUACAO_FASE)}
`;
}
