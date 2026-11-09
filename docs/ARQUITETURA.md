# Arquitetura — App de Controle de Concursos

> Documento de arquitetura derivado de [`REQUISITOS.md`](./REQUISITOS.md).
> Princípio-guia: **simplicidade** (uso pessoal ou de poucas pessoas, centenas de registros, roda
> local com um comando, hospedagem gratuita/barata opcional).
> Para uma introdução visual (diagramas e "onde mexo para…"), veja
> [`GUIA-ARQUITETURA.md`](./GUIA-ARQUITETURA.md).

---

## 1. Stack escolhida

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript** (strict) | Tipos de ponta a ponta (banco → domínio → UI). |
| Runtime | **Node.js 24 LTS** | LTS atual; suportado por Vercel/Docker. |
| Framework (front + back) | **Next.js (App Router) + React** | Um único projeto/processo: páginas via Server Components, mutações via Server Actions. Sem API separada para manter. |
| UI | **Tailwind CSS + shadcn/ui** (Radix) | Componentes acessíveis e responsivos copiados para o repo (sem dependência de lib de UI pesada). |
| Banco | **SQLite via libSQL** (`@libsql/client`) | Arquivo único local (`data/concurso.db`), backup trivial; o mesmo driver aponta para **Turso** se hospedado em serverless. |
| ORM / migrações | **Drizzle ORM + drizzle-kit** | Leve, SQL-like, tipagem inferida do schema, migrações versionadas em SQL. |
| Validação | **Zod** | Um schema por formulário/ação, reaproveitado no cliente (react-hook-form) e no servidor. |
| Formulários | **react-hook-form** + `@hookform/resolvers/zod` | Formulários grandes (RF01) com pouca re-renderização. |
| Datas | **date-fns** + **@date-fns/tz** | Cálculo de "hoje" e prazos em `America/Sao_Paulo`. |
| Markdown | **react-markdown** + **remark-gfm** (sem HTML bruto) | Observações (RF01) renderizadas com segurança. |
| Autenticação | **`jose`** (JWT HS256 e validação do `id_token` do Google) | Sessão em cookie assinado e OIDC próprio em poucas funções testáveis, sem biblioteca de auth completa (§7.1). |
| MCP | **`@modelcontextprotocol/server`** (SDK v2) | Servidor MCP (RF10) com stdio e HTTP web-standard (`fetch`) a partir da mesma definição; só depende de Zod. |
| Testes | **Vitest** (unit/integração) + **Playwright** (e2e smoke) | Rápidos; Vitest roda o domínio puro e o banco em memória. |
| Lint/format | **Biome** | Uma ferramenta só para lint + format, rápida, configuração mínima. |
| Pacotes | **pnpm** (via Corepack) | Rápido, lockfile determinístico. |

**Alternativa descartada:** SPA (Vite + React) + API separada (Express/Fastify) + Prisma. Descartada por
dobrar a superfície (dois projetos, contrato HTTP, CORS, dois deploys) sem benefício para um app pessoal;
Prisma também traz engine/binário extra e é mais pesado que Drizzle para SQLite/Turso.

---

## 2. Visão de alto nível

```mermaid
flowchart LR
  U[Navegador<br/>desktop / celular] -->|HTTPS| MW[proxy.ts<br/>auth opcional]
  MW --> RSC[Server Components<br/>páginas / leitura]
  MW --> SA[Server Actions<br/>mutações]
  MW --> RH[Route Handlers<br/>export/import, .ics, health]
  CAL[App de calendário] -->|feed .ics + token| RH
  LLM[Cliente MCP<br/>LLM + edital] -->|stdio ou HTTP + token| MCP[server/mcp<br/>ferramentas]
  RSC --> Q[server/queries]
  MCP --> Q
  MCP --> R
  SA --> D[domain/*<br/>regras puras]
  SA --> R[server/repositories]
  Q --> DB[(SQLite / libSQL<br/>arquivo local ou Turso)]
  R --> DB
  RH --> Q
```

- **`domain/`** é TypeScript puro (sem Next, sem banco): enums, transições de status, cálculo de prazos e
  validade. É o alvo principal dos testes (RNF07).
- **Leitura** acontece em Server Components chamando `server/queries`; **escrita** via Server Actions que
  validam com Zod → aplicam regras de `domain/` → persistem em transação → `revalidatePath`.

---

## 3. Modelo de dados

Convenções:
- IDs `integer` autoincremento. Timestamps técnicos (`created_at`, `updated_at`, `alterado_em`) em
  **UTC**, `integer` (epoch ms).
- **Datas de calendário** (eventos, homologação) como `text` `YYYY-MM-DD` e hora como `text` `HH:mm`,
  ambas interpretadas como **horário de Brasília** (wall-clock). Evita bugs de fuso em datas sem hora.
- **Dinheiro em centavos** (`integer`). Notas em `real`.
- Enums armazenados como `text` com valores em `SNAKE_CASE` (rótulos pt-BR ficam em `domain/labels.ts`).
- FKs filhas com `ON DELETE CASCADE`.

```mermaid
erDiagram
  USUARIO ||--o{ CONCURSO : "é dono"
  USUARIO ||--o{ EMAIL_PERMITIDO : "liberou"
  USUARIO ||--o{ AUDITORIA_ADMIN : "executou"
  CONCURSO ||--o{ LINK : tem
  CONCURSO ||--o{ EVENTO : tem
  CONCURSO ||--o{ STATUS_HISTORICO : registra
  CONCURSO ||--o{ RESULTADO_FASE : tem
  CONCURSO ||--o{ CONCURSO_TAG : ""
  TAG ||--o{ CONCURSO_TAG : ""
  CONCURSO ||--o{ ANEXO : "pós-MVP"
  USUARIO ||--o{ REGRA_NOTIFICACAO : personaliza
  CONCURSO ||--o{ NOTIFICACAO_ESTADO : "lida/dispensada"
  EVENTO ||--o{ NOTIFICACAO_ESTADO : ""
```

### 3.0 `usuario` (#49)

`id`, `email` (único, minúsculo; nulo só no usuário inicial não assumido), `google_sub` (único),
`nome`, `avatar_url`, `papel` (`USUARIO`/`ADMIN`), `mcp_token_hash` (SHA-256 do token do MCP),
`ultimo_acesso_em`, `bloqueado_em` (#50; nulo = ativo), `created_at`. `concurso.usuario_id` → `usuario.id` (`ON DELETE CASCADE`;
obrigatório, garantido por triggers porque a coluna foi adicionada com `ALTER TABLE`).

**Painel admin (#50, migração `0004_painel_admin`):**
- `email_permitido`: `email` (PK, minúsculo), `adicionado_por` → `usuario.id` (`SET NULL`),
  `created_at`. Allowlist do login Google gerenciada pelo painel, somada às variáveis de ambiente.
- `auditoria_admin`: `id`, `admin_id` e `alvo_usuario_id` → `usuario.id` (`SET NULL`), `admin` e
  `alvo` (cópias do e-mail/descrição no momento da ação, para o registro sobreviver a mudanças),
  `acao` (`PROMOVER_ADMIN`, `REBAIXAR_ADMIN`, `BLOQUEAR_USUARIO`, `DESBLOQUEAR_USUARIO`,
  `PERMITIR_EMAIL`, `REMOVER_EMAIL`, `REVOGAR_TOKENS` — #108; o enum existe só em TS e a coluna é
  texto, então novas ações não exigem migração), `created_at` (índice).

**Uso real (#108, migração `0007_uso_tokens`):**
- `usuario.mcp_token_usado_em` e `usuario.ics_token_usado_em` (epoch ms, nuláveis): último uso de
  cada token pessoal. Zerados junto com o resumo ao gerar ou revogar o token, ao revogar pelo
  painel e ao bloquear/desbloquear.
- `usuario.ultimo_acesso_em` passa a ser o último acesso real (login, páginas e ações com sessão,
  MCP por HTTP e feed `.ics`), não só o último login. Veja "Último acesso real" em §7.1.

**Lembretes (#65, migração `0005_lembretes`):**
- `usuario.ics_token_hash` (SHA-256 do token do feed de calendário, único), `ics_incluir_concluidos`
  (default true) e `ics_incluir_encerrados` (default false): opções do feed e do download geral.
- `regra_notificacao`: `usuario_id` → `usuario.id` (`CASCADE`), `tipo` (`TipoEvento`), `ativo`,
  `antecedencias` (`text` "7,1,0"); PK (`usuario_id`, `tipo`). Só os tipos que diferem do padrão
  (`domain/notificacoes`) são guardados.
- `notificacao_estado`: `chave` (PK, `evento-<id>:<dias>` ou `validade-<concursoId>:<dias>`),
  `concurso_id` → `concurso.id` e `evento_id` → `evento.id` (nulo no fim da validade; ambos
  `CASCADE`), `antecedencia`, `lida_em`, `dispensada_em`. A notificação em si não é guardada.
- `pendencia_status_dispensa` (#85): `concurso_id` → `concurso.id` e `evento_id` → `evento.id`
  (ambos `CASCADE`), `regra` (`RegraPendencia`), `data_evento`, `ate` (`null` = "não perguntar
  mais"; data = "lembrar depois" até esse dia), `created_at`; PK (`evento_id`, `regra`). Se o
  evento mudar de data, a dispensa deixa de valer. A pendência em si é calculada sob demanda.

### 3.1 `concurso` (RF01, RF03, RF05)

| Campo | Tipo | Obrig. | Observação |
|---|---|---|---|
| id | integer PK | ✔ | |
| orgao | text | ✔ | "TRF 3ª Região" |
| cargo | text | ✔ | cargo(s)/área |
| banca | text | | texto livre (autocomplete com valores já usados) |
| esfera | enum `Esfera` | | |
| uf | text(2) | | sigla validada |
| cidade | text | | |
| escolaridade | enum `Escolaridade` | | |
| remuneracao_centavos | integer | | |
| taxa_inscricao_centavos | integer | | |
| vagas_ampla | integer | | |
| vagas_cadastro_reserva | integer | | `null` = não informado; flag CR abaixo |
| possui_cadastro_reserva | boolean | | default false |
| vagas_cotas | integer | | total PcD + PPP etc. (detalhe em observações) |
| status | enum `Status` | ✔ | status atual (desnormalizado do histórico) |
| status_desde | integer (UTC) | ✔ | |
| observacoes | text (markdown) | | |
| homologacao_data | text (date) | | início da validade |
| validade_meses | integer | | 1–24 |
| validade_prorrogada | boolean | | default false |
| validade_fim_manual | text (date) | | sobrescreve o cálculo, se o edital dispuser diferente |
| validade_oculta_dashboard | boolean | | default false; oculta do dashboard o pseudo-evento de validade (#44) |
| cor | enum `CorConcurso` | | `null` = automática, derivada do ID (§7.4, #46) |
| icone | text | | um único emoji/símbolo (grafema), opcional (#46) |
| notificacoes_silenciadas | boolean | | default false; cala notificações e alarmes do concurso (#65) |
| busca_normalizada | text | ✔ | orgao+cargo+banca+tags em minúsculas sem acento (busca RF07) |
| created_at / updated_at | integer (UTC) | ✔ | |

### 3.2 `link` (RF02)
`id`, `concurso_id` FK, `tipo` enum `TipoLink`, `rotulo` text, `url` text (validada `http(s)://`),
`ordem` integer, `created_at`.

### 3.3 `evento` (RF04)
`id`, `concurso_id` FK, `tipo` enum `TipoEvento`, `titulo` text (opcional; default = rótulo do tipo),
`data` text `YYYY-MM-DD` ✔, `hora` text `HH:mm` (opcional), `local` text, `observacao` text,
`concluido` boolean (default false), `concluido_em` integer (UTC), `oculto_dashboard` boolean
(default false; oculta o evento da lista de próximos prazos do dashboard, #44), `created_at`,
`updated_at`. Índice: `(data, concluido)`.

### 3.4 `status_historico` (RF03)
`id`, `concurso_id` FK, `de` enum `Status` (null na criação), `para` enum `Status` ✔,
`alterado_em` integer (UTC) ✔, `observacao` text.

### 3.5 `resultado_fase` (RF05)
`id`, `concurso_id` FK, `fase` enum `Fase`, `descricao` text (ex.: "Discursiva — peça"), `ordem` integer,
`nota` real, `nota_maxima` real, `nota_corte` real, `classificacao_geral` integer,
`classificacao_cotas` integer, `lista_cotas` text (ex.: "PcD", "PPP"), `situacao` enum `SituacaoFase`
(default `PENDENTE`), `observacao` text.

### 3.6 `tag` e `concurso_tag` (RF01)
`tag`: `id`, `nome` text **unique** (normalizado: trim + minúsculas).
`concurso_tag`: `concurso_id` FK, `tag_id` FK, PK composta. Tags órfãs removidas ao salvar.

### 3.7 `anexo` (pós-MVP, RF02 desejável)
`id`, `concurso_id` FK, `nome_arquivo`, `mime`, `tamanho_bytes`, `chave_storage`, `created_at`.

### 3.8 Enums

| Enum | Valores |
|---|---|
| `Status` | `PREVISTO`, `EDITAL_PUBLICADO`, `INSCRITO`, `PROVA_AGENDADA`, `PROVA_REALIZADA`, `AGUARDANDO_RESULTADO`, `APROVADO`, `CLASSIFICADO`, `REPROVADO`, `NOMEADO`, `EMPOSSADO`, `DESISTIU`, `NAO_INSCRITO`, `SUSPENSO`, `CANCELADO` |
| `Esfera` | `FEDERAL`, `ESTADUAL`, `MUNICIPAL`, `DISTRITAL` |
| `Escolaridade` | `FUNDAMENTAL`, `MEDIO`, `TECNICO`, `SUPERIOR`, `POS_GRADUACAO` |
| `TipoLink` | `EDITAL_ABERTURA`, `RETIFICACAO`, `PAGINA_BANCA`, `AREA_CANDIDATO`, `GABARITO`, `RESULTADO`, `CONVOCACAO`, `OUTRO` |
| `TipoEvento` | `PUBLICACAO_EDITAL`, `INICIO_INSCRICOES`, `FIM_INSCRICOES`, `PEDIDO_ISENCAO`, `VENCIMENTO_BOLETO`, `PROVA_OBJETIVA`, `PROVA_DISCURSIVA`, `OUTRA_FASE` (TAF, títulos, psicotécnico, investigação social…), `GABARITO_PRELIMINAR`, `PRAZO_RECURSO`, `RESULTADO_FINAL`, `HOMOLOGACAO`, `CONVOCACAO`, `NOMEACAO`, `POSSE`, `VALIDADE`, `OUTRO` |
| `Fase` | `OBJETIVA`, `DISCURSIVA`, `TAF`, `TITULOS`, `PSICOTECNICO`, `INVESTIGACAO_SOCIAL`, `ORAL`, `CURSO_FORMACAO`, `OUTRA` |
| `SituacaoFase` | `PENDENTE`, `APROVADO`, `CLASSIFICADO`, `ELIMINADO`, `SUB_JUDICE` |
| `CorConcurso` | `AZUL`, `CIANO`, `VERDE_AGUA`, `VERDE`, `VIOLETA`, `MAGENTA`, `ROSA`, `CINZA` (`domain/cores.ts`) |

Semântica: **Aprovado** = dentro das vagas; **Classificado** = fora das vagas (cadastro de reserva);
**Reprovado** = eliminado/não classificado.

---

## 4. Regras de domínio (`src/domain`)

### 4.1 Transições de status

Trilha principal (índice): `PREVISTO(1) → EDITAL_PUBLICADO(2) → INSCRITO(3) → PROVA_AGENDADA(4) →
PROVA_REALIZADA(5) → AGUARDANDO_RESULTADO(6)`.

| De | Para permitido |
|---|---|
| Trilha principal (1–6) | qualquer status **posterior** da trilha (pode pular etapas) |
| `PREVISTO`, `EDITAL_PUBLICADO` | `NAO_INSCRITO` |
| `INSCRITO` … `AGUARDANDO_RESULTADO` | `DESISTIU` |
| `PROVA_REALIZADA`, `AGUARDANDO_RESULTADO` | `APROVADO`, `CLASSIFICADO`, `REPROVADO` |
| `APROVADO`, `CLASSIFICADO`, `REPROVADO` | entre si (revisão após recurso) |
| `APROVADO`, `CLASSIFICADO` | `NOMEADO`, `DESISTIU` |
| `NOMEADO` | `EMPOSSADO`, `DESISTIU` |
| qualquer não terminal | `SUSPENSO`, `CANCELADO` |
| `SUSPENSO` | o status anterior à suspensão (retomada) ou `CANCELADO` |

- **Terminais:** `EMPOSSADO`, `DESISTIU`, `NAO_INSCRITO`, `CANCELADO` (e `REPROVADO`, salvo revisão).
- **Desfazer:** sempre é possível desfazer a **última** mudança (remove o último registro do histórico
  e restaura o `de`), cobrindo erros de digitação sem liberar transições arbitrárias.
- Toda mudança grava `status_historico` e atualiza `concurso.status/status_desde` na mesma transação.
- API do domínio: `podeTransicionar(de, para)`, `transicoesPermitidas(de)`, `ehTerminal(s)`, `ehAtivo(s)`.
- **Pendências de status** (#65, #85, `domain/sugestao-status.ts`, sobre `domain/eventos-chave.ts`):
  quando um evento importante chega (`data <= hoje` ou concluído) ou passa (`data < hoje`), o app
  pergunta o que aconteceu. Regras, em ordem de prioridade: posse (Nomeado → Empossado/Desistiu),
  nomeação (Aprovado/Classificado → Nomeado), resultado final (Prova realizada/Aguardando →
  Aprovado/Classificado/Reprovado), recurso posterior à prova (Prova realizada → Aguardando
  resultado), prova passada, a partir do dia seguinte (Inscrito/Prova agendada: "Fez a prova?" →
  Prova realizada/Desistiu), boleto
  vencido e pendente ("Pagou o boleto?": antes da inscrição → Inscrito/Não inscrito; já inscrito →
  mantém e conclui o boleto / Desistiu), prova futura (Inscrito → Prova agendada), fim das
  inscrições (Previsto/Edital → Inscrito/Não inscrito) e edital (Previsto → Edital publicado). Só
  respostas que são transições permitidas. Nada para concursos terminais ou suspensos. Nunca
  automático: a UI (detalhe e card "Pendências de status" do dashboard) mostra a primeira pendência
  não dispensada; responder recalcula a pendência no servidor, usa `alterarStatus` e grava
  pergunta, resposta e motivo na observação do histórico. "Lembrar depois" (3 dias) e "Não
  perguntar mais" ficam em `pendencia_status_dispensa`. Respostas que levam a Desistiu pedem
  confirmação. Status e conclusão do evento (boleto pago) são gravados na mesma transação; "Sim"
  ao boleto já inscrito só conclui o evento (sem registro no histórico, que só guarda mudanças).
- **Contagem regressiva** (#84, `domain/contagem.ts`): próximo evento de prova (objetiva,
  discursiva, outra fase) não concluído com `data >= hoje`, para concursos em andamento (não
  terminais nem suspensos). Destaque para hoje, amanhã e até 7 dias; texto acessível (`sr-only`)
  "Prova objetiva em 12 dias, 14/11/2026". Exibida no detalhe do concurso e no card "Próximas provas" do dashboard.

### 4.2 Próximos prazos (RF06)

`proximosPrazos(eventos, concursos, hoje, janelaDias = 30)`:
1. `hoje` = data atual em `America/Sao_Paulo` (injetada, para testes determinísticos).
2. Considera eventos **não concluídos** de concursos **ativos** (não terminais); para `APROVADO`,
   `CLASSIFICADO`, `NOMEADO` consideram-se também convocação/nomeação/posse/validade.
3. Inclui **pseudo-evento de validade** derivado (4.3) se não houver evento `VALIDADE` explícito.
4. Classifica em grupos: **Vencidos** (`data < hoje`, não concluído — só tipos críticos), **Hoje**,
   **Próximos N dias**.
5. **Criticidade**: tipos críticos = `FIM_INSCRICOES`, `PEDIDO_ISENCAO`, `VENCIMENTO_BOLETO`,
   `PROVA_*`, `OUTRA_FASE`, `PRAZO_RECURSO`, `POSSE`. Destaque: ≤ 3 dias = alta, ≤ 7 = média.
6. Ordenação: `data` asc, depois `hora` (sem hora = "dia inteiro", vem primeiro), depois criticidade.
7. **Ocultos** (#44): cada prazo carrega `oculto` (de `evento.oculto_dashboard` ou, para o
   pseudo-evento, `concurso.validade_oculta_dashboard`). O agrupamento não os remove;
   `semOcultos(grupos)` filtra e `contarOcultos(grupos)` alimenta o contador "N ocultos". O
   dashboard esconde os ocultos por padrão e os mostra esmaecidos com `/?ocultos=1`. A preferência
   é só de exibição: calendário e MCP continuam listando todos os prazos (o MCP informa
   `ocultoNoDashboard`), e ocultar/reexibir não altera `updated_at`. A preferência fica no próprio
   registro, que já pertence a um único usuário (via concurso, #49).

`proximaData(concurso)` = menor `data >= hoje` entre eventos não concluídos → usado na ordenação RF07.

### 4.3 Validade do concurso (RF05)

```
se validade_fim_manual → usa ela
senão se homologacao_data e validade_meses:
  fim = homologacao_data + validade_meses
  se validade_prorrogada: fim = fim + validade_meses   (prorrogação única, por igual período — CF art. 37, III)
senão → indefinida
```
- Validação: `validade_meses` entre 1 e 24.
- Exibe "vence em X dias" e alerta quando faltam ≤ 90 dias (para lembrar de acompanhar convocações).

### 4.4 Notificações (RF08, #65)

`domain/notificacoes.ts`, puro, com `hoje` injetado:
- **Regras** por `TipoEvento` (inclui `VALIDADE`, o fim da validade): `ativo` e antecedências em dias
  (0–365, até 6, sem repetição). `REGRAS_PADRAO`: fim de inscrição 7/1/0; isenção e boleto 2/0;
  provas e `OUTRA_FASE` 7/1; recurso 1/0; convocação, nomeação e posse 3/0; validade 90/30; os
  demais desligados. `mesclarRegras(personalizadas)` sobrescreve o padrão tipo a tipo.
- **Disparo sem cron** (`notificacoesDisparadas`): eventos não concluídos, de hoje em diante, de
  concursos acompanhados e não silenciados, mais o pseudo-evento de validade (§4.3). Para cada
  prazo, no máximo uma notificação: a da **antecedência vigente** = menor antecedência ≥ dias
  restantes (quem abre o app na véspera vê só "amanhã"). Identidade = (prazo, antecedência), sem a
  data: retificar a data mantém a notificação (e o estado). Do banco vêm só lida/dispensada.
- Ordenação: dia de disparo (`data − antecedência`) desc, depois data/hora do prazo.
- O contador do sino é calculado no layout do app. Toda Server Action que chama `revalidatePath`
  recebe na própria resposta a rota atual re-renderizada a partir da raiz (layout incluso), então o
  sino atualiza sem `router.refresh()` (#73).
- Mudanças feitas fora desta aba (MCP, outro aparelho) não chegam sozinhas: não há refresh
  automático, polling nem realtime, para poupar as invocações do plano gratuito da hospedagem. O
  botão **Atualizar** (#77, `layout/botao-atualizar.tsx`), no cabeçalho do celular e na barra
  lateral do desktop, chama `router.refresh()` no máximo uma vez por minuto (hora do último clique
  no `sessionStorage`, regra em `lib/atualizar.ts`); na espera fica com `aria-disabled` e o rótulo
  diz quanto falta. Custo real de um clique: a requisição do refresh e mais os prefetches dos links
  visíveis, porque o `router.refresh()` limpa o cache do roteador no navegador (cerca de 13
  requisições no detalhe do concurso, no desktop).

### 4.5 Calendário iCalendar (RF08, #65)

`domain/icalendar.ts` (RFC 5545), puro, com o instante da geração injetado (`DTSTAMP`):
- Sem hora → dia inteiro (`DTSTART;VALUE=DATE`, `DTEND` no dia seguinte, `TRANSP:TRANSPARENT`).
  Com hora → convertido de Brasília para **UTC** via `instanteSP` (sem `VTIMEZONE`; respeita o
  histórico do fuso), 1 h de duração.
- `UID` estável: `evento-<id>@<host>` / `validade-<concursoId>@<host>`. Importar um backup renumera
  os eventos, o que troca os `UID`s (o calendário assinado recria os eventos uma vez).
- `SUMMARY` = [✓ se concluído] [ícone] nome do prazo — órgão; `DESCRIPTION` com tipo, concurso,
  observação e link; `URL` e `LAST-MODIFIED`.
- `VALARM` (`DISPLAY`) só em prazos críticos (§4.2) pendentes de concursos ativos e não
  silenciados, um por antecedência da regra do tipo: dia inteiro → 9h do dia do aviso; com hora →
  mesmo horário `d` dias antes, ou 2 h antes no dia.
- Texto escapado (barra invertida, `;`, `,`, quebras), linhas dobradas em 75 octetos UTF-8, CRLF;
  `REFRESH-INTERVAL`/`X-PUBLISHED-TTL` de 4 h.
- Opções: incluir concluídos e concursos encerrados (feed e download geral); o download de um
  concurso traz todos os eventos dele.

### 4.6 Navegação e filtro do calendário (#83)

`domain/navegacao-calendario.ts`, puro, com `hoje` injetado. A URL é a fonte da verdade e continua
compartilhável: `?mes=AAAA-MM` (ausente ou inválido = mês de hoje) e `?concursos=1,3` (IDs dos
concursos exibidos; ausente = todos, vazio = nenhum). `lerSelecaoConcursos` ignora IDs inválidos
(sem nenhum válido, vale "todos"); `normalizarSelecao` descarta IDs que não são do usuário e volta a
"todos" quando a seleção cobre todos os concursos, para a URL ficar limpa e concursos novos
aparecerem. `hrefCalendario(mes, selecao)` monta todos os links de navegação (anterior, hoje,
seguinte, seletor e atalhos), então o filtro se mantém ao trocar de mês.

- A página lê **todos** os itens do usuário (`obterCalendarioCompleto`: eventos de qualquer data e
  validades calculadas) e recorta o mês (`itensDoMes`). O resto alimenta a contagem por mês
  (`contarPorMes`) e os atalhos: um app pessoal tem poucas centenas de eventos, e uma leitura só é
  mais simples que várias consultas agregadas.
- **Seletor de mês e ano** (`calendario/seletor-mes.tsx`): o título do mês abre um popover com os
  12 meses do ano e a quantidade de eventos de cada um (com o filtro aplicado), e setas de ano que
  não vão ao servidor. Cada mês é um link, então funciona igual no desktop e no celular. Faz as
  vezes da visão anual sem uma tela a mais.
- **Atalhos**: "Próximos eventos" (`proximoMesComEventos`: primeiro mês depois do exibido com
  itens visíveis) e "Próxima prova" (`proximaProva`, com a regra da contagem regressiva do #84:
  `contagemRegressiva` + `compararContagens` sobre provas e outras fases de concursos em andamento).
- **Filtro de concursos** (`calendario/filtro-concursos.tsx`): a legenda cor/ícone (#46) virou
  toggles com `aria-pressed` e o nome do concurso como rótulo, mais "só este" e "Mostrar todos".
  Lista os concursos com itens no mês (antes do filtro, para poder religá-los) e os selecionados.
  Desligar um partindo de "todos" seleciona os demais (`alternarConcurso`).

---

## 5. Rotas, telas e ações

### 5.1 Páginas (App Router)

| Rota | Tela | Fase |
|---|---|---|
| `/` | **Dashboard**: pendências de status no topo, próximos prazos (vencidos/hoje/30 dias) com concluir na linha e painel do evento (#100), próximas provas, contagem por status; ocultar/reexibir prazos pelo painel, `?ocultos=1` mostra os ocultos | MVP |
| `/concursos` | **Lista** com busca, filtros e ordenação em `searchParams` (URL compartilhável) | MVP |
| `/concursos/novo` | **Formulário** de cadastro; ao salvar abre o detalhe na aba Eventos (#100) | MVP |
| `/concursos/[id]` | **Detalhe** em abas: Visão geral · Eventos · Links · Resultados · Histórico; a aba aberta fica em `?aba=` (#77): abas controladas pelo `useSearchParams`, troca gravada com `history.replaceState`, sem ir ao servidor. `?evento=<id>` destaca um evento e `?foco=validade` o card Validade; `de`/`mes`/`concursos` definem o link de volta (allowlist); `?mudar=status` abre "Mudar status". Cabeçalho: Editar, Mudar status e menu Mais ações (.ics, Silenciar, Excluir) (#100) | MVP |
| `/concursos/[id]/editar` | Formulário de edição | MVP |
| `/configuracoes` | Regras de notificação, calendário (.ics), exportar/importar dados, token do MCP, acesso | MVP |
| `/notificacoes` | **Central de notificações** (#65): marcar como lida, marcar todas, dispensar | v2.2 |
| `/login` | Login Google e/ou senha única (só se auth habilitada) | MVP |
| `/admin` | **Painel admin** (#50, só papel `ADMIN`; 403 para os demais): visão geral com totais de usuários, concursos e eventos, uso (ativos em 7/30 dias, com token do MCP, com feed .ics; #108) e ações recentes | v1.4 |
| `/admin/usuarios` | Usuários (nome, e-mail, papel, cadastro, último acesso real, selos MCP/.ics e "Sem acesso hoje", nº de concursos); promover/rebaixar, bloquear/desbloquear | v1.4 · #108 |
| `/admin/usuarios/[id]` | Detalhe (#108): origem do acesso, "sem acesso hoje" e motivo, conta Google vinculada, contagens agregadas (concursos, eventos, links, resultados), tokens MCP/.ics com último uso; **Revogar tokens**. ID inválido ou inexistente → página 404 (o status sai 200 por causa do `loading.tsx` do painel) | #108 |
| `/admin/acesso` | Allowlist do login Google: e-mails das variáveis (só leitura) e liberados no painel (adicionar/retirar) | v1.4 |
| `/admin/auditoria` | Log das ações administrativas (últimas 200) | v1.4 |
| `/concursos?visao=quadro` | Quadro por status (kanban; arrastar ou “Mover para” = transição validada) | v1.1 |
| `/calendario?mes=AAAA-MM&concursos=1,3` | Visão mensal de eventos (agenda em lista no celular); clique abre o painel do evento (concluir, ocultar, editar, ver no concurso; gaveta no celular, #100); cor/ícone por concurso com legenda (#46); seletor de mês e ano com eventos por mês, atalhos "Próximos eventos" e "Próxima prova", e filtro de concursos pela legenda (#83, §4.6) | v1.1 |

Layout responsivo (alvo: 360 px sem rolagem horizontal, #48): navegação lateral no desktop, barra
inferior no celular; menu da conta (avatar) com Sair e, só para admins, o seletor de
visão (§7.1). No celular o cabeçalho tem só marca, sino de notificações e menu da conta (na
visão admin, o selo no lugar do sino); o tema fica dentro do menu (#78). Um único sino por tela,
e sobra espaço para mais um ícone em 360 px. Configurações fica só na navegação principal e o
tema só junto ao avatar (barra lateral no desktop, menu da conta no celular), sem duplicação (#82).
Em telas de toque (`pointer: coarse`), botões,
campos, abas e seletores crescem para 36–40 px, sem mudar o desktop. Tabelas largas rolam dentro do próprio contêiner (`relative
overflow-x-auto`, para o `sr-only` não escapar). Links externos com
`target="_blank" rel="noopener noreferrer"`.

PWA (#66): `app/manifest.ts` (`standalone`), ícones em `public/icons/` e `app/apple-icon.png`, e
`appleWebApp` no layout raiz (`lib/pwa.ts`). A `<meta name="theme-color">` não vem do
`viewport.themeColor` (o Next a recriaria a cada navegação): o `SCRIPT_TEMA` a cria antes da
pintura e o seletor de tema a atualiza, então a barra de status segue o tema efetivo (§7.3). O
proxy libera o manifest e os ícones sem sessão. Sem service worker por enquanto: o Chrome já instala sem ele (o Web Push, opcional em #65, ficou para depois).
Os ícones são gerados de `assets/logo.svg` por `pnpm icones` (`scripts/gerar-icones.ts`).

### 5.2 Server Actions (`src/server/actions`)

| Ação | Descrição |
|---|---|
| `criarConcurso`, `atualizarConcurso`, `excluirConcurso` | RF01 (+ tags no mesmo payload) |
| `alterarStatus(id, para, obs?)`, `desfazerUltimoStatus(id)` | RF03, usa `domain/status` |
| `salvarLink`, `excluirLink`, `reordenarLinks` | RF02 |
| `salvarEvento`, `excluirEvento`, `alternarConcluido` | RF04 |
| `alternarPrazoOculto(chave, oculto)` | RF06 — oculta/reexibe um prazo do dashboard (`evento-<id>` ou `validade-<concursoId>`, #44) |
| `salvarResultadoFase`, `excluirResultadoFase` | RF05 |
| `login`, `logout` | Auth |
| `gerarTokenMcpAcao`, `revogarTokenMcpAcao` | Token pessoal do MCP (#49) |
| `marcarNotificacaoLidaAcao(chave)`, `dispensarNotificacaoAcao(chave)`, `marcarTodasLidasAcao()` | #65 — estado das notificações (`evento-<id>:<dias>` / `validade-<id>:<dias>`) |
| `salvarRegrasNotificacaoAcao(regras)`, `restaurarRegrasPadraoAcao()`, `silenciarConcursoAcao(id, silenciado)` | #65 — regras e silenciamento por concurso |
| `gerarTokenIcsAcao`, `revogarTokenIcsAcao`, `salvarOpcoesIcsAcao(opcoes)` | #65 — feed de calendário |
| `responderPendenciaStatus(id, chave, resposta)` | #65, #85 — responde à pendência de status recalculada no servidor (`<regra>-<eventoId>`) |
| `dispensarPendenciaStatus(id, chave, modo)` | #85 — `"lembrar"` (3 dias) ou `"dispensar"` a pendência |
| `alternarVisaoAcao(visao)` | #50 — "usuario" ou "admin" (só admins); grava o cookie da visão e leva a `/` ou `/admin` |
| `definirPapelAcao(id, papel)`, `definirBloqueioAcao(id, bloqueado)` | #50 — admin; protege o último admin ativo e os de `ADMIN_EMAILS` |
| `adicionarEmailPermitidoAcao(email)`, `removerEmailPermitidoAcao(email)` | #50 — admin; allowlist do painel |
| `revogarTokensAcao(id)` | #108 — admin; revoga os tokens MCP e .ics sem bloquear, auditado (`REVOGAR_TOKENS`); devolve `{ revogou }` (sem tokens ativos, não muda nada nem audita) |

Todas: checagem de sessão (`exigirUsuarioAcao`, ou `exigirAdminAcao` no painel) → validação Zod →
`executar` (transação no repositório; `ErroDominio` vira mensagem, exceção inesperada vira
mensagem genérica e uma linha `acao.erro` no log com `{ acao, usuarioId }`, §9.4; erros de
controle do Next são relançados com `unstable_rethrow`) → `revalidatePath`. Retorno padronizado `{ ok: true, data } | { ok: false, erros }`
(`actions/resultado.ts`).

O `revalidatePath` faz a resposta da action trazer a tela atual já re-renderizada (uma viagem só ao
servidor). Por isso os componentes **não** chamam `router.refresh()` depois de `r.ok` (#73): isso
seria uma segunda requisição refazendo todas as queries do layout e da página. Exceções: a importação
(`POST /api/import`, Route Handler) e as falhas ao mover ou desfazer no quadro, que não revalidam
nada. Criar, editar e excluir concurso terminam com `redirect()` na própria action (fora de
`executar`, que engoliria o erro de controle): a resposta já traz a página de destino.

As páginas têm `loading.tsx` (#73): o esqueleto é pré-carregado e aparece na hora ao navegar. Como
o stream começa no fallback, o status HTTP fica fixado em 200 antes de a página rodar: um
`notFound()` no detalhe de um concurso inexistente (ou de outro usuário) mostra a página de não
encontrado com `<meta name="robots" content="noindex">`, mas com status 200, e o `redirect` da
visão admin no dashboard vira redirecionamento no cliente. Aceito: as páginas exigem login. O
`forbidden()` do painel admin continua 403, porque fica no layout, acima do `loading.tsx`.

### 5.3 Route Handlers (`src/app/api`)

| Rota | Uso |
|---|---|
| `GET /api/export?formato=json\|csv\|ics` | RF09 — `json` (padrão) = backup completo do usuário; `csv` = só os concursos (separador `;`, BOM UTF-8, proteção contra fórmulas); `ics` = RF08, todos os concursos ou `&concurso=<id>` |
| `POST /api/import` | RF09 — `multipart/form-data` com `arquivo` e `confirmacao=SUBSTITUIR_TUDO`; substitui todos os dados do usuário numa transação (até 20 MB; valida com Zod e `schemaVersion`; IDs renumerados) |
| `GET /api/health` | health check do deploy |
| `POST/GET/DELETE /api/mcp` | RF10 — servidor MCP (Streamable HTTP); exige `Authorization: Bearer <token pessoal>` |
| `GET /api/auth/google` e `/api/auth/google/callback` | #49 — login com Google (OIDC, código + PKCE) |
| `GET /api/calendario.ics?token=…` | RF08 (#65) — feed assinável; pública no `proxy.ts`, autenticada pelo token do feed (`cics_…`, SHA-256 em `usuario.ics_token_hash`); token inválido/revogado, usuário bloqueado ou sem acesso (#96) → 404; atraso progressivo como o MCP |

### 5.4 Servidor MCP (`src/server/mcp`, RF10)

Uma LLM com acesso ao edital cadastra e atualiza concursos pelo
[Model Context Protocol](https://modelcontextprotocol.io). A mesma fábrica `criarServidorMcp({ db,
usuarioId, aoAlterar })` serve dois transportes; cada instância só enxerga os dados do usuário
(#49):

- **stdio** — `pnpm --silent mcp` (`scripts/mcp.ts`), uso local, com os dados do usuário inicial;
  muda para a raiz do projeto, carrega o `.env`, aplica migrações e só escreve no stdout pelo
  protocolo.
- **HTTP** — `app/api/mcp/route.ts` com `createMcpHandler` (web-standard, stateless; uma instância
  do servidor por requisição, presa ao dono do token via `authInfo`). Pública no `proxy.ts` porque
  se autentica sozinha: token pessoal gerado em Configurações (`cmcp_…`; o banco guarda só o
  SHA-256 em `usuario.mcp_token_hash`), com o mesmo atraso progressivo do login. Após escritas,
  `revalidatePath`.

Camadas:

| Arquivo | Papel |
|---|---|
| `entradas.ts` | Schemas Zod do JSON da LLM (reais, `null` limpa, omitido mantém) → JSON Schema das ferramentas; conversores para os valores crus dos formulários |
| `operacoes.ts` | Valida com os **mesmos** schemas da UI (`lib/schemas/*`) e grava pelos repositórios; retorno `{ ok, data }` ou `{ ok, erros }`, com o caminho do item nos lotes (`eventos[2].data`) |
| `servidor.ts` | Registra ferramentas, recursos (`concurso://referencia`, `concurso://concursos/{id}`) e prompts (`cadastrar_edital`, `aplicar_retificacao`); erros viram `isError` com texto para a LLM corrigir |
| `textos.ts` | Instruções, guias dos prompts e referência dos enums com rótulos pt-BR |

Decisões (issue #39):
- **Sem ferramentas destrutivas** — nada é excluído pelo MCP; exclusões só pela UI. Todas as
  ferramentas anunciam `destructiveHint: false`.
- **Um concurso = um cargo** — o usuário escolhe o cargo no edital e a LLM preenche só os dados dele.
- **Tudo ou nada** — `cadastrar_concurso` grava concurso + eventos + links + tags numa transação
  (`criarConcursoCompleto`); `salvar_eventos`/`salvar_links` idem (`salvarEventos`/`salvarLinks`).
  Valida tudo antes de abrir a transação e devolve todos os erros de uma vez.
- **Duplicados** — `domain/duplicados.ts` compara órgão e cargo por Jaccard de palavras (sem acento
  nem palavras vazias; números diferentes distinguem órgãos). O cadastro recusa parecidos salvo
  `ignorarDuplicados`.
- **Leitura do edital no cliente** — o servidor não baixa PDFs (sem `ler_edital(url)` por ora).

---

## 6. Estrutura de pastas

```
.
├── .github/
│   ├── workflows/ci.yml            # lint, typecheck, testes, build, e2e, imagem Docker
│   ├── workflows/release.yml       # tag vX.Y.Z → GitHub Release
│   ├── dependabot.yml              # npm + actions, semanal, PRs para develop
│   └── pull_request_template.md
├── assets/                         # logo.svg (fonte dos ícones) e icon.svg
├── docs/                           # REQUISITOS.md, ARQUITETURA.md, GUIA-ARQUITETURA.md
├── drizzle/                        # migrações SQL geradas (versionadas)
├── data/                           # concurso.db local (gitignored)
├── e2e/                            # testes Playwright
├── public/icons/                   # ícones PNG do PWA (gerados por `pnpm icones`)
├── scripts/                        # migrate, seed, backup, mcp (stdio), gerar-icones, env
├── src/
│   ├── app/                        # rotas: (app)/ com navegação, admin/, login/, api/, manifest.ts
│   ├── components/
│   │   ├── ui/                     # shadcn/ui
│   │   ├── concurso/               # formulários, cards, quadro, badges, sugestão de status
│   │   ├── calendario/             # visão mensal, seletor de mês, filtro (#83)
│   │   ├── evento/                 # painel do evento, badge de situação, destaque do deep-link (#100)
│   │   ├── avisos/                 # avisos (toast) com Desfazer e aviso vindo da URL (#100)
│   │   ├── formulario/             # proteção de alterações não salvas, foco no erro (#100)
│   │   ├── dashboard/              # lista de prazos (concluir na linha), ocultar/reexibir
│   │   ├── configuracoes/          # regras de notificação, calendário .ics, export/import, token MCP
│   │   ├── admin/                  # painel admin (#50)
│   │   ├── auth/                   # login (Google/senha) e sair
│   │   ├── layout/                 # casca, navegação, menu da conta, botão Atualizar
│   │   ├── notificacoes/           # sino e central de notificações (#65)
│   │   └── tema/                   # seletor de tema (claro/escuro/sistema)
│   ├── domain/                     # regras puras + testes *.test.ts ao lado
│   │   ├── enums.ts  labels.ts  erros.ts
│   │   ├── status.ts  prazos.ts  validade.ts
│   │   ├── calendario.ts  navegacao-calendario.ts  quadro.ts  cores.ts  duplicados.ts
│   │   ├── notificacoes.ts  icalendar.ts  sugestao-status.ts   # lembretes (#65, #85)
│   │   └── eventos-chave.ts  contagem.ts   # evento relevante e contagem regressiva (#84, #85)
│   ├── server/
│   │   ├── db/                     # schema.ts, client.ts, migrate.ts, url.ts, backup.ts
│   │   ├── queries/                # leituras (lista, dashboard, detalhe, notificações, .ics)
│   │   ├── repositories/           # escritas transacionais
│   │   ├── actions/                # Server Actions
│   │   ├── mcp/                    # servidor MCP (ferramentas, entradas, textos)
│   │   ├── auth/                   # sessão, senha, Google, autorização, visão admin
│   │   ├── log.ts                  # logger estruturado (§9.4)
│   │   ├── erro-requisicao.ts      # onRequestError → log (§9.4)
│   │   └── inicializacao.ts        # checagem do ambiente e migrações ao iniciar
│   ├── lib/                        # format, tz, normalize, csv, tema, pwa, tags, aba-concurso, atualizar, schemas Zod
│   ├── instrumentation.ts          # inicialização ao subir o servidor e onRequestError (§9.4)
│   └── proxy.ts
├── biome.json  drizzle.config.ts  next.config.ts  vitest.config.ts  playwright.config.ts
├── .env.example  .nvmrc  CHANGELOG.md  package.json
```

---

## 7. Autenticação e locale

### 7.1 Autenticação e multiusuário (#49)
- **Multiusuário:** tabela `usuario` (e-mail, `google_sub`, nome, foto, papel `USUARIO`/`ADMIN`,
  resumo do token MCP, último acesso). `concurso.usuario_id` define o dono; links, eventos,
  histórico, resultados e anexos pertencem a ele via concurso. `tag` é um vocabulário compartilhado
  (só nomes): cada usuário vê apenas as tags dos próprios concursos. Toda query e repositório recebe
  o `usuarioId` e filtra por ele; escritas em filhas exigem antes que o concurso seja do usuário
  (`exigirConcurso`). Teste dedicado: `src/server/isolamento.test.ts`.
- **Usuário inicial (ID 1):** criado pela migração `0003_multiusuario` como admin sem e-mail e dono
  dos dados existentes. É assumido pelo primeiro login Google de um e-mail de `ADMIN_EMAILS`; o
  login por senha e o modo sem login usam sempre ele.
- **Local (padrão):** sem login configurado → auth desligada, tudo é do usuário inicial.
- **Login Google:** OIDC próprio (`server/auth/google.ts`, só `jose`): código de autorização com
  PKCE, `state` e `nonce` num cookie assinado de 10 min; `id_token` validado pelas chaves públicas
  do Google (emissor, público, expiração, `nonce`, e-mail verificado). Acesso por allowlist,
  conferida também a cada requisição (`auth/autorizacao.ts`, ver "Painel admin" abaixo).
- **Senha única (`APP_PASSWORD`):** uso local; comparada em tempo constante, com atraso progressivo
  após falhas. Em produção não pode coexistir com o Google.
- **Sessão:** cookie **JWT assinado** (`jose`, HS256 com `AUTH_SECRET` ≥ 32 bytes) com o ID do
  usuário e o método de login; `httpOnly`, `Secure` em produção, `SameSite=Lax`, 30 dias. `proxy.ts` confere só
  a assinatura (sem banco) e protege tudo exceto `/login`, `/api/health`, `/api/auth/google…`,
  `/api/mcp`, `/api/calendario.ics` e o manifest e os ícones do PWA (`lib/pwa.ts`); páginas, Server
  Actions e Route Handlers obtêm o usuário em `auth/acesso.ts`
  (`exigirUsuarioPagina/Acao/Rota`), que relê o usuário no banco.
- Em produção (`NODE_ENV=production`) sem login, o app **recusa iniciar** salvo
  `ALLOW_NO_AUTH=true` explícito — evita expor dados por esquecimento.
- Sem biblioteca de auth completa (NextAuth, Better Auth): um provedor só não justifica a
  dependência, e o fluxo OIDC cabe em poucas funções testáveis.
- **MCP (§5.4):** `/api/mcp` não usa o cookie de sessão; exige `Authorization: Bearer <token>` com o
  token pessoal do usuário. O token (e o do feed `.ics`) só vale enquanto o dono puder usar o app,
  pela mesma regra da sessão (`donoDoTokenAutorizado` em `auth/autorizacao.ts`, #96): conta não
  bloqueada e, para o usuário inicial, `APP_PASSWORD` definido (ou sem login); para os demais,
  conta Google ainda autorizada. Retirar o e-mail da allowlist recusa os tokens na hora.

**Painel admin (#50):**
- **Quem entra com Google** (`auth/autorizacao.ts`): quem não está bloqueado e (a) tem o e-mail em
  `ADMIN_EMAILS` ou `ALLOWED_EMAILS`, (b) tem o e-mail liberado no painel (`email_permitido`) ou
  (c) já é admin no banco. As variáveis continuam valendo e só mudam na configuração do servidor; o
  painel soma e-mails a elas. A regra é a mesma no login e a cada requisição, então retirar um
  e-mail ou bloquear vale na hora, inclusive para sessões abertas.
- **Admins:** `ADMIN_EMAILS` são admins garantidos (promovidos a cada login, não podem ser
  rebaixados nem bloqueados pelo painel). Outros usuários podem ser promovidos no painel; o papel dá
  acesso por si só, então para tirar um admin rebaixa-se ou bloqueia-se.
- **Último admin:** sempre resta um admin ativo (papel `ADMIN`, não bloqueado). Rebaixar ou
  bloquear um admin só acontece se existir outro admin ativo, conferido no próprio `UPDATE`
  (`WHERE … AND EXISTS (outro admin ativo)`), sem janela de corrida. Ninguém bloqueia a própria
  conta; quem se rebaixa volta para a visão usuário.
- **Bloqueio:** `usuario.bloqueado_em`. Barra o login (Google e senha), a sessão existente
  (relida a cada requisição) e os tokens do MCP e do feed de calendário, que são apagados ao
  bloquear (#96; desbloqueado, o usuário gera outros). Os dados ficam guardados e voltam a valer ao
  desbloquear. Sem login configurado (uso local), o bloqueio não se aplica.
- **Visão admin ↔ visão usuário:** seletor no menu da conta, só para admins, sem novo login. A
  escolha fica no cookie `concurso_visao` (`auth/visao.ts`) e decide o início (`/` redireciona a
  `/admin` na visão admin). A visão usuário é o app comum, sem nenhum item de admin; a visão admin
  usa outra navegação e a faixa "Modo admin". A visão **nunca** concede acesso: páginas `/admin`
  chamam `exigirAdminPagina()` (papel relido do banco; `forbidden()` → 403, com
  `experimental.authInterrupts`) e as ações, `exigirAdminAcao()` ("Acesso restrito a
  administradores").
- **Auditoria:** toda alteração do painel grava em `auditoria_admin` na mesma transação.
- **Privacidade:** o painel mostra só totais e metadados das contas — flags, datas técnicas e
  contagens agregadas (#108); não há impersonação nem acesso aos concursos de outros usuários. Os
  resumos dos tokens e o `google_sub` saem das leituras convertidos em flag (testado).
- **Último acesso real (#108):** `usuarioAtual` (`auth/acesso.ts`) registra o acesso, e não
  `usuarioDaSessao` (pura) nem o `proxy.ts`; `/api/mcp` e `/api/calendario.ics`, após autorizar,
  registram o acesso e o `*_usado_em` do canal (só para o token atual, conferido pelo resumo). É
  uma única escrita condicional, sem leitura prévia (`UPDATE … WHERE x IS NULL OR x < agora - 15
  min`, throttle por usuário e coluna), aguardada (sem `after()`) e protegida por `try/catch` +
  `log.warn("auth.registro_acesso_falhou")`. O `cache()` só deduplica por renderização; Server
  Actions e Route Handlers podem chamar de novo, e o throttle limita. Prefetch conta como acesso.
  Todos os chamadores são dinâmicos, então nada é gravado no build.
- **Sem acesso hoje (#108):** `acessoHoje` (`auth/autorizacao.ts`) reproduz `donoDoTokenAutorizado`
  sem consultas (a allowlist do painel vem de um `LEFT JOIN` na listagem) e explica o resultado:
  origens (`OrigemAcesso`) e motivo (`MotivoSemAcesso`: bloqueado, login Google desligado, usuário
  inicial sem conta Google com a senha desligada, e-mail fora das listas). Um teste confere as duas
  regras em todas as combinações.

**Cabeçalhos de segurança (#95):** `next.config.ts` aplica a todas as rotas os cabeçalhos de
`src/lib/cabecalhos-seguranca.ts`: CSP, `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (recursos não usados
desligados) e `Cross-Origin-Opener-Policy: same-origin`. A CSP é sem nonce (`script-src 'self'
'unsafe-inline'`): o Next injeta scripts inline e o nonce exigiria renderizar tudo pelo `proxy.ts`,
que não roda sem login. Ela restringe o resto à própria origem (imagens também de
`*.googleusercontent.com`, as fotos de perfil), proíbe `<object>`, embutir o app
(`frame-ancestors 'none'`) e formulários para fora. Não usa `upgrade-insecure-requests`, que
quebraria o app servido por HTTP na rede local; em dev acrescenta `'unsafe-eval'` (pilhas de erro
do React). O e2e `seguranca.spec.ts` confere os cabeçalhos e a ausência de violações no console.

### 7.2 Locale (RNF04)
- `<html lang="pt-BR">`; toda a UI em pt-BR (sem i18n framework — strings diretas + `labels.ts`).
- `lib/format.ts`: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`,
  `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })` → `dd/mm/aaaa`.
- `lib/tz.ts`: `hojeSP()` e conversões via `@date-fns/tz` (`TZDate`). Nunca usar `new Date()` "solto"
  em regra de domínio — `hoje` é parâmetro.
- Entrada de moeda: máscara `R$ 1.234,56` → centavos (`parseBRL`). Entrada de data: `<input type="date">`
  (nativo, bom no celular) exibindo `dd/mm/aaaa` nos textos.
- Busca sem acento/maiúsculas via `busca_normalizada` (`normalize('NFD')` + remoção de diacríticos).
- Testes rodam com `TZ=UTC` para garantir que o código não depende do fuso da máquina.

### 7.3 Tema claro/escuro
- Preferência **Claro / Escuro / Sistema** (padrão: Sistema, via `prefers-color-scheme`), salva no
  `localStorage` (`concurso:tema`). Seletor só junto ao avatar: barra lateral (desktop) e menu
  da conta do celular (#78, #82) (`components/tema/seletor-tema.tsx`, hook `useTema`); no modo
  Sistema acompanha mudanças do SO.
- Sem flash: script inline no `<head>` do layout raiz (`SCRIPT_TEMA`, `lib/tema.ts`) aplica a classe
  `dark` e o `color-scheme` no `<html>` antes da primeira pintura; o variant `dark:` do Tailwind usa
  essa classe.
- Barra de gestos do Android (#81): `<meta name="color-scheme" content="light dark">`,
  `color-scheme` no `<html>` (SCRIPT_TEMA; `:root`/`.dark` sem JS) e `bg-background` no `<html>` e
  no `<body>`; com
  `viewport-fit=cover`, o fundo da raiz e a barra inferior fixa (com
  `env(safe-area-inset-bottom)`) cobrem a área atrás da barra de gestos.
- Cores sempre por tokens CSS (`globals.css`, `:root` e `.dark`), nunca fixas por tema. Atenção/aviso
  usa `--aviso` (borda/fundo) e `--aviso-foreground` (texto, contraste AA nos dois temas).

### 7.4 Cor e ícone do concurso (#46)
- Paleta fechada (`CorConcurso`, `domain/cores.ts`) com tokens `--concurso-<cor>` em `globals.css`,
  um tom escuro no `:root` e um claro no `.dark`. A cor é só marcador (ponto ao lado do nome, nunca
  fundo de texto), com contraste ≥ 3:1 (WCAG 1.4.11) contra fundo, cartão e `muted` nos dois temas
  — verificado em teste (`src/app/paleta-concurso.test.ts`). Vermelho e âmbar ficam de fora:
  são da criticidade dos prazos, que mantém borda esquerda + fundo no calendário e no painel.
- Sem escolha (`cor = null`), `corPadrao(id)` = `id × 5 mod 8`: determinística e permutação da
  paleta (IDs consecutivos têm cores diferentes). `corDoConcurso` resolve a cor exibida; as
  leituras de prazos/calendário já entregam a cor resolvida.
- Ícone: um único grafema (emoji com modificadores/ZWJ incluído), validado com `Intl.Segmenter`.
- Exibição via `components/concurso/marcador-concurso.tsx`: itens e diálogo de detalhes do
  calendário, legenda cor → concurso (concursos com itens no mês, que também filtra o calendário,
  #83), próximos prazos do dashboard,
  lista, quadro e cabeçalho do detalhe. Formulário: rádios nativos com amostras ("Automática"
  mostra a cor derivada na edição) e campo de ícone com sugestões.
- Backup JSON (`schemaVersion` 1): `concursos[].cor`/`icone` opcionais (ausentes = `null`). MCP:
  `cor`/`icone` em cadastrar/atualizar; a ficha devolve `cor`, `corExibida` e `icone`.

---

## 8. Testes, CI e versionamento

### 8.1 Estratégia de testes
| Nível | Ferramenta | Escopo | Meta |
|---|---|---|---|
| Unitário | Vitest | `domain/*` (transições, prazos, validade, criticidade), `lib/format`, parsers BRL, schemas Zod | meta: cobertura ≥ 90% em `domain/` (medida no CI, sem limite configurado) |
| Integração | Vitest + libSQL `:memory:` + migrações | repositories/queries (transação de status, tags, filtros, export→import ida e volta); servidor MCP com cliente em memória (`InMemoryTransport`) | casos principais |
| E2E | Playwright (Chromium) | smoke: criar concurso → evento → aparece no dashboard → mudar status → exportar/importar; login, MCP, PWA e lembretes com auth ativa; painel admin com o usuário inicial (sem auth), incluindo selos MCP/.ics, detalhe do usuário e revogar tokens → `/api/mcp` 401 e feed 404 (#108); busca, quadro, calendário (navegação rápida e filtro de concursos no desktop e em 360 px, #83), cor/ícone, ocultar prazos, tema, lembretes (sino, regras, feed .ics), sino único por tela e tema pelo menu no celular, tema e Configurações sem duplicação (#82), PWA, aba do detalhe na URL e botão Atualizar com limite de 60 s (#77), deep-link e volta à origem, painel do evento com concluir/Desfazer, cabeçalho do concurso, avisos e alterações não salvas (#100) e layout em 360 px; `/api/mcp` com token → concurso visível no app. Dois servidores (com e sem auth) com bancos temporários em `e2e/.tmp` | poucos fluxos |

Datas sempre fixadas (`vi.setSystemTime` / `hoje` injetado).

### 8.2 CI (GitHub Actions)
`ci.yml` — gatilhos: `pull_request` para `develop` e `master`; `push` em `develop` e `master`.

```
jobs:
  check:  pnpm install --frozen-lockfile → biome ci → pnpm typecheck → vitest run --coverage → pnpm build
  e2e:    (needs: check) pnpm e2e (Playwright/Chromium, navegadores em cache)
  docker: (needs: check) docker build + smoke test: sem login o container sai com código 1;
          com APP_PASSWORD responde /api/health e recusa /api/export e /api/mcp sem credencial (401)
  branch-policy: em PRs para master, falha se head ≠ release/* ou hotfix/*
```
- **Proteção de branches**: `master` e `develop` exigem PR + CI verde; sem push direto.
- `release.yml`: em push de tag `v*.*.*` → cria GitHub Release com as notas da seção da versão no
  `CHANGELOG.md` (`v0.*` como pre-release). Não publica imagem Docker: ela é gerada a partir do
  `Dockerfile` por quem fizer o deploy.
- Dependabot semanal (npm + actions) com PRs para `develop`.

### 8.3 Versionamento semântico
- `0.x` durante a construção do MVP; **`v1.0.0` = MVP completo**.
- Versão bumpada em `package.json` na branch `release/X.Y.Z`; `CHANGELOG.md` no formato
  *Keep a Changelog*; PR para `master` → tag `vX.Y.Z` → PR da mesma `release/*` de volta para `develop`.
- `hotfix/*` incrementa PATCH. Mensagens de commit no estilo *Conventional Commits* (recomendado,
  não obrigatório por ferramenta).
- Mudança de schema = nova migração Drizzle; o JSON de export carrega `schemaVersion`.

---

## 9. Deploy e backup

### 9.1 Local (padrão, RNF01)
```
pnpm install
pnpm dev        # aplica migrações pendentes (predev) e sobe em http://localhost:3000
```
`pnpm build && pnpm start` para uso diário em modo produção local.

### 9.2 Hospedado (opcional, RNF08)
| Opção | Custo | Quando |
|---|---|---|
| **Vercel (Hobby) + Turso (free)** — recomendada | R$ 0 | Zero manutenção; `DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN` (ou `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`, da integração do Marketplace). Migrações rodadas no build. |
| Docker (imagem `standalone`, `Dockerfile` na raiz) em VPS/Fly.io com volume para `data/`; migrações ao iniciar (`MIGRATE_ON_START=true`) | ~US$ 2–5/mês | Se quiser anexos em disco local ou evitar serviço de banco externo. |

O mesmo código atende ambas: só muda `DATABASE_URL` (`file:./data/concurso.db` vs `libsql://…`).

### 9.3 Backup
- **Local:** `pnpm db:backup` → `VACUUM INTO 'backups/concurso-AAAAMMDD-HHmm.db'` (cópia consistente);
  manter as últimas N. Pasta `backups/` no `.gitignore` (dados pessoais **nunca** no repositório).
- **Turso:** point-in-time restore do próprio serviço + export JSON manual periódico.
- **Universal:** export JSON em `/configuracoes` (RF09), restaurável via import — também serve para
  migrar entre local ↔ hospedado.
- Não usar artefatos do GitHub Actions para backup (visíveis se o repositório for público).

### 9.4 Logs e observabilidade (#91)

`src/server/log.ts`: logger próprio, sem dependências. Uma linha por evento, no stdout (`debug`,
`info`) ou no stderr (`warn`, `error`), que é o que a plataforma já coleta: terminal do
`pnpm dev`/`pnpm start`, `docker logs` e *Runtime Logs* da Vercel. Nada é gravado em arquivo nem
no banco; a retenção é a do ambiente (na Vercel, a do plano; no Docker, a do driver de log).

```ts
log.warn("auth.login_falhou", { metodo: "senha", motivo: "senha_incorreta", ip });
```

| Variável | Padrão | Efeito |
|---|---|---|
| `LOG_LEVEL` | `info` em produção, `debug` em dev, `silent` em teste | nível mínimo: `debug`, `info`, `warn`, `error` ou `silent`. `log.fatal` (erro que encerra o processo na inicialização) sai sempre |
| `LOG_FORMAT` | `json` em produção, `texto` fora dela | `json` (uma linha JSON `{ ts, nivel, evento, ...campos }`) ou `texto` legível, com a stack nas linhas seguintes |

**Erros de servidor.** `onRequestError` (`src/instrumentation.ts` → `server/erro-requisicao.ts`)
registra `requisicao.erro` com método, caminho (só o pathname, mais os **nomes** dos parâmetros
da query, nunca os valores), `routePath`, `routeType` (`render`/`route`/`action`/`proxy`),
`renderSource` e `digest` de todo erro que o Next captura.
O Next continua imprimindo o erro no formato dele: a linha estruturada é acrescentada, e o `digest`
liga as duas (é o mesmo exibido ao usuário na página de erro). Erros de controle (`redirect`,
`notFound`…) são ignorados. O Next chama o hook mais de uma vez para o mesmo erro quando layout e
página caem na mesma query memorizada: o mesmo objeto de erro é registrado uma vez a cada 2 s (um
erro guardado em módulo e relançado em requisições seguintes volta a aparecer depois da janela).
O hook só vê o que **escapa** do código: `executar` (Server Actions e MCP), `/api/import`,
`/api/health` e o `onerror` do MCP tratam o erro e registram por conta própria.

**Catálogo de eventos.**

| Evento | Nível | Campos |
|---|---|---|
| `requisicao.erro` | error | `metodo`, `caminho`, `parametros` (nomes), `rota`, `tipo`, `origem`, `digest`, `erro` |
| `acao.erro` | error | `acao` (ex.: `concursos.criarConcurso`, `mcp.cadastrar`), `usuarioId`, `erro` |
| `acao.recusada` | debug | `acao`, `usuarioId`, `motivo` (mensagem do `ErroDominio`) |
| `auth.login_ok` | info | `metodo` (`senha`/`google`), `usuarioId` |
| `auth.login_falhou` | warn (info se `cancelado`) | `metodo`, `motivo`, `ip`; Google: `email` mascarado e `erro` quando houver. Motivos com senha: `senha_incorreta`, `conta_bloqueada` (só detectado depois que a senha confere). Com Google: `nao_autorizado` (fora da allowlist), `bloqueado`, `erro_google` (troca do código ou `id_token` inválido), `estado_invalido` (state/cookie expirado ou forjado), `cancelado` |
| `auth.limite_tentativas` | warn | `rota` (`login`, `mcp`, `ics`), `ip`, `esperaMs`: só quando uma falha **inicia** um bloqueio, não a cada tentativa recusada durante a espera |
| `auth.token_invalido` | warn | `rota` (`mcp`, `ics`), `ip`, `ausente`; token válido de quem perdeu o acesso (#96): também `usuarioId` e `motivo: "sem_acesso"` |
| `auth.registro_acesso_falhou` | warn | `canal` (`sessao`, `mcp`, `ics`), `usuarioId`, `erro`: falha ao gravar o último acesso/uso (#108); a requisição segue normalmente |
| `auth.logout` | info | `usuarioId` (lido do cookie assinado, sem consultar o banco; o logout nunca falha por causa do log) |
| `auth.config_invalida` | error | `erro` (proxy) |
| `dados.importacao` / `dados.importacao_recusada` / `dados.importacao_erro` | info / info / error | `usuarioId`, contagens do resumo, `motivo` ou `erro` |
| `dados.exportacao` | info | `usuarioId`, `formato`, `concurso` (id validado, só no `.ics` de um concurso); só depois de gerar o arquivo com sucesso |
| `mcp.ferramenta` | info (error se lançar) | `usuarioId`, `ferramenta`, `ok`, `duracaoMs`, sem os argumentos |
| `mcp.erro` | error | `erro` (transporte/protocolo) |
| `health.falhou` | error | `erro` |
| `inicio.*` | info/warn/fatal | migrações aplicadas ou com falha, auth desligada, config inválida, `MCP_TOKEN` obsoleto |

**Privacidade.** Nunca são registrados senha, tokens (sessão, MCP, `.ics`), cookies, cabeçalhos,
corpo da importação nem os argumentos das ferramentas MCP. O logger ainda omite qualquer campo
cujo nome lembre um segredo (`senha`, `token`, `secret`, `cookie`, `authorization`…) e, em
qualquer texto (inclusive mensagens e stacks de erro): remove o valor de parâmetros de URL
sensíveis (`code`, `state` e nomes com `token`, `senha`, `pass`, `secret`, `key`, `auth`, `sess`,
`email`…) e mascara e-mails (`r***@gmail.com`). O `requisicao.erro` nem chega a registrar valores
de query. Das mensagens de erro do Drizzle sai tudo de `params: …` em diante (valores da query, que
podem ter várias linhas, e-mails e dados do usuário); a SQL fica. Quando há usuário, registra-se o
`usuarioId`. O `ip` (de `x-forwarded-for`/`x-real-ip`, ou `local`) só
aparece em eventos de segurança; fora de um proxy confiável ele pode ser forjado pelo cliente.
IP e e-mail mascarado são dados pessoais (LGPD): ficam apenas com a retenção do provedor de logs.

**MCP stdio.** `pnpm --silent mcp` usa o stdout como canal JSON-RPC: `scripts/mcp.ts` chama
`configurarLog({ saida: "stderr" })` antes de importar o resto, e todo log vai para o stderr.
`scripts/mcp.test.ts` sobe o script real, faz o handshake e uma chamada de ferramenta e confere
que o stdout só tem JSON-RPC.

**Log da aplicação × auditoria.** `auditoria_admin` (§3.0, painel `/admin/auditoria`) é a trilha
permanente, no banco, das ações administrativas, visível ao admin. Os logs são operacionais e
efêmeros: servem para investigar erros e tentativas de acesso.

---

## 10. Roadmap (ordem de implementação)

Cada item = uma branch `feature/*` a partir de `develop`; cada milestone fecha com `release/X.Y.Z`.

| Milestone | Branches (em ordem) | Entrega |
|---|---|---|
| **M0 — Fundação** → `v0.1.0` | `feature/setup-projeto` (Next, TS, Biome, Vitest, pnpm, `.env.example`) · `feature/ci-github-actions` · `feature/banco-schema-drizzle` (schema completo + migrações + client) · `feature/layout-base-pt-br` (shadcn, navegação responsiva, `format.ts`/`tz.ts`) | App vazio rodando, CI verde |
| **M1 — Cadastro** → `v0.2.0` | `feature/dominio-status` (enums, labels, transições + testes) · `feature/crud-concurso` (RF01, lista simples, detalhe) · `feature/tags` · `feature/historico-status` (RF03: troca, desfazer, timeline) · `feature/links` (RF02) | Concursos cadastráveis com status e links |
| **M2 — Prazos** → `v0.3.0` | `feature/eventos` (RF04) · `feature/dominio-prazos` (cálculo + testes) · `feature/dashboard` (RF06: prazos + contagem por status) | "O que vem a seguir" visível |
| **M3 — Busca e pós-prova** → `v0.4.0` | `feature/busca-filtros` (RF07) · `feature/resultados-fases` (RF05) · `feature/validade-concurso` | Ciclo completo até nomeação |
| **M4 — Backup e hospedagem** → **`v1.0.0` (MVP)** | `feature/export-import` (RF09) · `feature/autenticacao` · `feature/e2e-playwright` · `feature/deploy` (Vercel+Turso, Dockerfile, `db:backup`, README) | MVP pronto para uso diário |
| **M5 — Visões** → `v1.1.0` | `feature/kanban` · `feature/calendario` | RF06 desejáveis |
| **Cadastro assistido** → `v1.2.0` | `feature/mcp` (issue #39) | RF10: servidor MCP para cadastrar/atualizar a partir do edital |
| **Ajustes de uso** → `v1.3.0` | `feature/markdown-tabelas` (#43) · `feature/dashboard-ocultar-eventos` (#44) · `feature/calendario-popup` (#45) · `feature/tema-escuro` (#47) · `feature/cor-concurso` (#46) | Melhorias pedidas no uso diário |
| **Multiusuário** → `v2.0.0` | `feature/login-google-multiusuario` (#49) · `feature/painel-admin` (#50) | Login Google, dados por usuário, painel admin (RF11) |
| **Integração Vercel + Turso** → `v2.1.0` | `feature/turso-env-vercel` (#62) | Lê `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` da integração do Marketplace |
| **PWA e celular** → `v2.2.0` | `feature/pwa-mobile` (#66, #48) | App instalável (manifest, ícones) e responsividade em 360 px |
| **M6 — Lembretes** → `v2.2.0` | `feature/lembretes` (#65): feed/download .ics, notificações no app com regras configuráveis, sugestão de status. E-mail descartado (2026-11-01) | RF08 |
| **Desempenho** → `v2.3.0` | `feature/performance-mutacoes` (#73) | Mutações com uma viagem só ao servidor e esqueletos de carregamento |
| **Uso diário** → `v2.4.0` | `feature/atualizar-dados` (#77) · `feature/sino-unico` (#78) · `feature/tema-layout` (#81, #82) · `feature/eventos-dashboard` (#84, #85) · `feature/calendario-navegacao` (#83) | Botão Atualizar, contagem regressiva das provas, pendências de status e navegação rápida no calendário |
| **Observabilidade** → `v2.5.0` | `feature/logs` (#91) | Logger estruturado, `onRequestError` e eventos de segurança e operação |
| **UX dos eventos** → `v2.6.0` | `feature/ux-fluxo-eventos` (#100) | Painel do evento, concluir no dashboard, link direto para o evento, voltar à origem e avisos com Desfazer |
| **M7 — Anexos** → `v2.7.0` | `feature/anexos` | RF02 desejável |

---

## 11. Riscos e decisões pendentes (seção 7 dos requisitos)

| # | Questão | Padrão proposto | Impacto na arquitetura |
|---|---|---|---|
| 1 | Local ou hospedado? | **Local-first**, com hospedagem opcional pronta (Vercel+Turso). Auth ligada por variável de ambiente (Google multiusuário ou senha única); produção sem login bloqueada por padrão. | Nenhum retrabalho: driver libSQL e proxy de auth já previstos. |
| 2 | Anexos no MVP? | **Não** — só links no MVP (edital costuma estar em URL pública). Anexos no M7 com interface `Storage` (`disco local` / Vercel Blob ou Cloudflare R2), limite 10 MB, só PDF/imagem. | Tabela `anexo` já desenhada; backup passa a incluir arquivos. |
| 3 | E-mail desde o início? | **Não — e não será feito** (decisão de 2026-11-01). O feed **.ics assinável** (M6) faz o Google/Apple Calendar notificar no celular de graça, e as notificações no app cobrem o uso na web. | Sem cron, sem segredo extra e sem serviço de e-mail; .ics funciona até local (download manual). |

**Outros riscos**
- **Fuso/datas** (prazos errados por 1 dia): datas como `YYYY-MM-DD` de Brasília, `hoje` injetado,
  testes com `TZ=UTC`.
- **SQLite em serverless** (sistema de arquivos efêmero): mitigado pelo Turso; nunca usar arquivo local na Vercel.
- **Evolução rápida do Next.js** (APIs de cache/Server Actions mudam): manter regras em `domain/` e
  acesso a dados em `server/`, deixando o Next como camada fina e substituível.
- **Perda de dados**: backups locais rotativos + export JSON; migrações sempre reversíveis por restore
  do backup feito antes de `db:migrate`.
- **Scope creep** (plano de estudos, scraping): fora do escopo; registrar como ideias, não no roadmap.
