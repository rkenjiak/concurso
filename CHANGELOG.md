# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- Servidor MCP (RF10, #39) para cadastrar e atualizar concursos com uma LLM que tem acesso ao
  edital: o usuário escolhe o cargo e `cadastrar_concurso` grava concurso + eventos + links + tags
  numa única transação, com `simular: true` para conferir antes e recusa de concursos parecidos
  (órgão e cargo, sem acento; números distinguem órgãos) salvo `ignorarDuplicados`. Ferramentas
  `atualizar_concurso` (só os campos informados), `alterar_status` (transição validada, histórico e
  status permitidos na recusa), `salvar_eventos`/`salvar_links` (lotes tudo ou nada, para
  retificações), `registrar_resultado`, `listar_concursos`, `obter_concurso`, `proximos_prazos` e
  `verificar_duplicado`; recursos `concurso://referencia` e `concurso://concursos/{id}`; prompts
  `cadastrar_edital` e `aplicar_retificacao`. Sem ferramentas de exclusão. Entradas em reais e
  validadas pelos mesmos schemas Zod da UI, com erros por campo (`eventos[2].data`) para a LLM
  corrigir. Uso local por stdio (`pnpm --silent mcp`) e hospedado por HTTP em `/api/mcp`,
  desligado sem `MCP_TOKEN` (≥ 32 caracteres, `Authorization: Bearer`, atraso progressivo após
  falhas), independente da senha do app. SDK `@modelcontextprotocol/server` v2.

## [1.1.0] - 2026-10-31

### Adicionado

- Visão em quadro (kanban) dos concursos (RF06) em `/concursos?visao=quadro`, com alternância
  Lista/Quadro que preserva busca, filtros e ordenação. Uma coluna por status na ordem do pipeline
  (trilha principal, Aprovado, Classificado, Nomeado) e os encerrados/suspensos agrupados numa
  coluna recolhível. Cartões com órgão, cargo, banca, próxima data pendente e tags; o nome abre o
  detalhe. Mover um cartão — arrastando (HTML5 nativo, destaca as colunas permitidas) ou pelo menu
  “Mover para” de cada cartão (teclado e celular) — usa a mesma ação da troca de status: transição
  validada pelo domínio (mensagem quando não permitida), histórico gravado e botão “Desfazer”.
  Rolagem horizontal no celular.
- Calendário mensal de eventos (RF04/RF06) em `/calendario`, com item na navegação: semana de
  domingo a sábado, mês na URL (`?mes=AAAA-MM`) com navegação anterior/hoje/próximo, dia de hoje
  destacado (horário de Brasília), prazos críticos destacados como no dashboard (vencidos e até 3
  dias em vermelho, até 7 dias em âmbar), eventos concluídos e de concursos encerrados esmaecidos e
  fim de validade calculado incluído. Cada evento leva ao concurso. No celular, vira uma agenda do
  mês em lista. Grade do mês pura e testada em `domain/calendario.ts` (anos bissextos, meses
  começando em qualquer dia da semana, 4 a 6 semanas).

## [1.0.0] - 2026-10-31

### Adicionado

- Exportação e importação de dados (RF09) em `/configuracoes`: backup JSON versionado
  (`schemaVersion` 1) com todas as tabelas — concursos, tags, links, eventos, histórico de status,
  resultados por fase e anexos —, preservando IDs e instantes em ISO 8601 (`GET
  /api/export?formato=json`), e CSV dos concursos para planilhas (`;`, BOM UTF-8, valores em reais
  e rótulos em pt-BR, com proteção contra fórmulas; `?formato=csv`). Importação (`POST
  /api/import`) valida o arquivo com Zod (formato, versão, campos e referências entre tabelas) com
  mensagens que indicam o campo com problema, rejeita versões desconhecidas e substitui todos os
  dados em uma única transação (tudo ou nada) após confirmação explícita; a busca normalizada é
  recalculada. Teste de ida e volta (exportar → importar → dados idênticos).
- Autenticação opcional por senha única (§7.1, RNF06): desligada sem `APP_PASSWORD`; com ela,
  página `/login`, sessão em cookie JWT assinado com `AUTH_SECRET` (`jose`, HS256, `httpOnly`,
  `SameSite=Lax`, `secure` em produção, 30 dias), senha comparada em tempo constante, atraso
  progressivo após 5 falhas por cliente e "Sair" em Configurações. `proxy.ts` protege todas as
  rotas exceto `/login`, `/api/health` e arquivos estáticos (APIs respondem 401), e todas as Server
  Actions e Route Handlers checam a sessão de novo. Em produção sem `APP_PASSWORD` o app recusa
  iniciar, salvo `ALLOW_NO_AUTH=true`; `AUTH_SECRET` com menos de 32 bytes também impede o início.
- Testes e2e com Playwright (Chromium) contra o build de produção, cada servidor com um banco
  SQLite temporário recriado a cada execução: cadastrar concurso → mudar status → adicionar evento →
  ver no dashboard; busca sem acento e filtro por status; exportar/excluir/importar backup (inclui
  versão desconhecida); e, em um projeto separado com `APP_PASSWORD`, login, senha errada, 401 nas
  APIs, cookie de sessão e logout. Script `pnpm e2e` e job `e2e` no CI (com cache do Chromium).
- Deploy (§9, RNF08): `Dockerfile` multi-stage com saída `standalone` do Next (`NEXT_OUTPUT=standalone`),
  Node 24, usuário sem privilégios, banco SQLite em volume (`/app/data`), `HEALTHCHECK` e
  migrações ao iniciar (`MIGRATE_ON_START=true`), além de `.dockerignore` que exclui dados, backups
  e `.env`; job `docker` no CI constrói a imagem e testa o health check, o 401 sem sessão e a
  recusa de iniciar sem senha. Instruções para Vercel + Turso (sem `vercel.json`; migrações no build via
  `DATABASE_URL`/`DATABASE_AUTH_TOKEN`).
- `pnpm db:backup`: cópia consistente do banco local com `VACUUM INTO` em
  `backups/concurso-AAAAMMDD-HHmm.db`, mantendo as últimas N (`--manter=N` ou `BACKUP_KEEP`, padrão
  10); recusa bancos remotos com orientação para o Turso.
- README reescrito: o que é, início rápido, variáveis de ambiente, autenticação, backup e
  restauração, deploy na Vercel + Turso e com Docker, scripts e Gitflow.
- Health check `GET /api/health` (público; 200 se o banco responde, 503 caso contrário).

### Alterado

- Páginas do app movidas para o grupo de rotas `(app)` (com a navegação); a raiz só define
  `<html>`/`<body>`, permitindo a tela de login sem navegação. URLs inalteradas.

## [0.4.0] - 2026-10-31

### Adicionado

- Busca, filtros e ordenação na lista de concursos (RF07): busca sem acento/maiúsculas por órgão,
  cargo, banca e tags (todos os termos, em qualquer ordem); filtros por status (vários), esfera, UF,
  escolaridade e faixa de remuneração (em reais); ordenação por próxima data (sem data por último),
  maior remuneração, cadastro mais recente ou nome. Estado na URL (compartilhável, inclusive os
  links de contagem por status do dashboard), validado com Zod; "Limpar filtros", contagem de
  resultados, estado vazio próprio e próxima data exibida em cada concurso.
- Resultados por fase (RF05): aba "Resultados" no detalhe do concurso para adicionar, editar e
  excluir o resultado de cada fase (fase, descrição, nota, nota máxima, nota de corte, classificação
  geral e nas cotas com a lista, situação e observação). Notas aceitam vírgula ou ponto (até 3 casas)
  e não podem passar da nota máxima; validação Zod compartilhada entre cliente e servidor.
- Validade do concurso (§4.3, `domain/validade.ts`): fim = homologação + N meses (1–24), somando o
  mesmo período a partir do primeiro fim quando prorrogada, com data manual que sobrescreve o
  cálculo; meses somados com ajuste ao fim do mês e anos bissextos; situação vigente, vencendo
  (≤ 90 dias) ou expirada, com `hoje` injetado e cobertura total. Campos de homologação, meses,
  prorrogação e fim manual no formulário do concurso; card de validade no detalhe com dias
  restantes ou há quantos dias expirou, e alerta quando faltam 90 dias ou menos.
- Dashboard passa a exibir o fim da validade calculado como prazo (quando não há evento "Validade
  do concurso" explícito).

## [0.3.0] - 2026-10-31

### Adicionado

- Eventos do concurso (RF04): aba "Eventos" no detalhe com adicionar, editar e excluir eventos (tipo,
  título opcional, data, hora opcional, local, observação, concluído), ordenados por data (sem hora
  primeiro, depois por hora), e marcar/desmarcar concluído direto na lista; `concluido_em` registrado
  na conclusão. Validação Zod compartilhada entre cliente e servidor.
- Cálculo de próximos prazos (`domain/prazos.ts`, §4.2): agrupa eventos não concluídos de concursos
  ativos em vencidos (só tipos críticos), hoje e próximos N dias (padrão 30); criticidade por tipo
  (alta ≤ 3 dias, média ≤ 7), ordenação por data/hora/criticidade, pseudo-evento de validade a partir
  do fim de validade informado, `proximaData` e texto relativo ("em 3 dias"); `hoje` sempre injetado
  e testes unitários exaustivos.
- Dashboard (RF06) na página inicial: próximos prazos agrupados em vencidos, hoje e próximos 30 dias
  (data de hoje em America/Sao_Paulo), com destaque visual de prazos críticos (urgente ≤ 3 dias, esta
  semana ≤ 7), hora, local e link para o concurso; contagem de concursos por status em cards que
  levam à lista filtrada; estados vazios orientando o cadastro de concursos e eventos.
- Lista de concursos aceita filtro por status via `?status=` (com atalho para remover o filtro).

### Corrigido

- Campo de tags do formulário de concurso: Enter volta a adicionar a tag digitada (o popup nativo do
  `<datalist>` absorvia a tecla). As sugestões agora são uma lista própria (combobox acessível, com
  setas, Enter e Esc), filtrada sem acento, e há um botão para adicionar a tag; digitar um texto
  igual a uma tag existente não a adiciona mais antes do Enter.

### Alterado

- Dependabot ignora atualizações semver-major de `typescript` e `@types/node`.

## [0.2.0] - 2026-10-31

### Adicionado

- Rótulos pt-BR de todos os enums do domínio e lista de UFs (`domain/labels.ts`).
- Regras de transição de status (`domain/status.ts`): trilha principal com saltos, resultados revisáveis,
  terminais, suspensão com retomada do status anterior e desfazer a última mudança, com testes.
- Cadastro de concursos (RF01): formulário de criação/edição com validação Zod compartilhada entre
  cliente e servidor, máscara de moeda BRL, lista em `/concursos`, detalhe em `/concursos/[id]` com
  observações em markdown (sem HTML bruto) e exclusão com confirmação; `busca_normalizada` mantida
  a cada gravação e status inicial registrado no histórico.
- Tags livres nos concursos (RF01): criação e reaproveitamento com sugestões no formulário, remoção,
  exibição como badges na lista e no detalhe, inclusão na busca normalizada e limpeza de tags órfãs.
- Histórico de status (RF03): troca de status no detalhe do concurso limitada às transições
  permitidas, com observação opcional, desfazer a última mudança e linha do tempo; histórico e status
  atual gravados na mesma transação. Detalhe do concurso organizado em abas.
- Links do concurso (RF02): adicionar, editar, excluir e reordenar links com rótulo, tipo e URL
  validada (apenas `http`/`https`), abertos em nova aba com `rel="noopener noreferrer"`.

## [0.1.0] - 2026-10-31

### Adicionado

- Projeto Next.js (App Router) + React + TypeScript strict, Tailwind CSS, Biome e Vitest (testes em `TZ=UTC`).
- Scripts pnpm `dev`, `build`, `start`, `lint`, `format`, `typecheck` e `test`; `.env.example` e `.nvmrc`.
- CI no GitHub Actions (Biome, tipos, testes com cobertura, build e política de branches para `master`),
  release automática a partir de tags `vX.Y.Z`, template de PR e Dependabot apontando para `develop`.
- Banco SQLite/libSQL com Drizzle ORM: schema completo (concurso, link, evento, status_historico,
  resultado_fase, tag, concurso_tag, anexo), migração inicial em `drizzle/`, client via `DATABASE_URL`/
  `DATABASE_AUTH_TOKEN`, migrações automáticas antes de `dev`/`build` e seed opcional com dados fictícios.
- Normalização de texto para busca (`lib/normalize.ts`).
- shadcn/ui (Radix, preset Nova) com tema claro/escuro conforme o sistema e cor primária do ícone do app.
- Layout responsivo em pt-BR (`<html lang="pt-BR">`): navegação lateral no desktop e barra inferior no
  celular, com páginas iniciais de Dashboard, Concursos e Configurações.
- Utilitários de locale: `lib/format.ts` (moeda BRL, `parseBRL`, datas `dd/mm/aaaa` no fuso
  `America/Sao_Paulo`) e `lib/tz.ts` (`hojeSP`, conversões e aritmética de datas de calendário), com testes.
