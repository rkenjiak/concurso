# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

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
