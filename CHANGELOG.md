# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- **Índice e seções em Configurações** (#106): os cards ficam agrupados em **Avisos**
  (Notificações, Calendário .ics), **Dados** (Exportar e importar), **Integrações** (Token do MCP)
  e **Conta** (Acesso), com títulos h2/h3 reais, e um índice "Nesta página" com âncoras para cada
  card (`#notificacoes`, `#calendario`, `#exportar`, `#mcp`, `#acesso`). As âncoras param abaixo
  do cabeçalho fixo do celular e os links do índice têm 44 px no toque.

- **Uso real no painel admin** (#108): a visão geral mostra quantos usuários estiveram ativos em 7
  e 30 dias e quantos têm token do MCP ou feed `.ics` ativo. A tabela de usuários ganhou os selos
  **MCP** e **.ics** (token ativo), com o último uso na dica e para leitores de tela, e o selo
  **Sem acesso hoje**. O MCP local por stdio (`pnpm mcp`) não usa token e não é contado.
- **Detalhe do usuário** (#108) em `/admin/usuarios/{id}`: origem do acesso (`ADMIN_EMAILS`,
  `ALLOWED_EMAILS`, liberado no painel, papel admin ou usuário inicial), "Sem acesso hoje" com o
  motivo (pela mesma regra que vale para os tokens), conta Google vinculada, contagens de
  concursos, eventos, links e resultados, e os tokens com o último uso. Só flags, datas e
  contagens: o conteúdo dos concursos continua privado.
- **Revogar tokens** (#108) sem bloquear: apaga o token do MCP e o link do feed `.ics` do usuário,
  com confirmação e registro na auditoria ("Revogou os tokens (MCP e .ics) de"). Sem tokens
  ativos, nada muda nem é auditado.

### Alterado

- **Papel de Notificações** (#104): o Dashboard mostra o que fazer agora; `/notificacoes` mostra os
  avisos que as suas regras geraram para prazos ainda pendentes, agrupados pela proximidade do
  prazo (**Hoje e amanhã**, **Próximos 7 dias**, **Mais adiante**) e, em cada grupo, do prazo mais
  próximo para o mais distante (data e hora). Agrupar pelo dia do disparo enganava: com a regra de
  prova em 7 e 1 dias, "Prova objetiva é hoje" ficava em "Ontem". Os grupos são título e lista,
  sem landmark por grupo. A descrição da tela diz isso e aponta para o Dashboard, o botão **Regras** virou **Configurar avisos** e os botões
  de marcar como lida e dispensar têm 44 px no toque.
- **Notificações na barra inferior do celular** (#105): Notificações, com o contador de não lidas
  (o nome acessível traz o número real), ocupa o lugar de Configurações, que é de uso raro.
  Configurações passou para o menu da conta (avatar) e o sino saiu do cabeçalho do celular, para
  manter um só ponto de entrada de notificações por layout (#78). O desktop não muda. Sem nome nem
  e-mail (usuário local), o avatar mostra um ícone de pessoa em vez de "?".
- Limpeza sem mudança de comportamento (#107): `useConcluirEvento` e `useDesfazerStatus` têm uma
  fonte única, e o zoom do `dialog` (centro e gaveta no desktop) e do `alert-dialog` só anima
  quando o sistema não pede movimento reduzido (`prefers-reduced-motion`); o fade continua, e o
  slide da gaveta no celular já seguia a mesma regra.

- Gerar ou revogar um token, bloquear e desbloquear passam a zerar também o último uso do token
  (#108), para o painel não mostrar "usado há 2 dias" em quem já não tem token.

### Corrigido

- **"Último acesso"** no painel admin (#108) era, na verdade, o último login: com sessões de 30
  dias e o uso por MCP ou `.ics`, quem usava o app todo dia aparecia com acesso de semanas atrás
  (e, sem login configurado, o campo nunca mudava). Agora conta páginas, Server Actions, MCP por
  HTTP e o feed `.ics`, gravado no máximo a cada 15 minutos por usuário, numa única escrita
  condicional; uma falha ao registrar só gera aviso no log.
- **HTTP 404 de verdade** em `/concursos/{id}`, `/concursos/{id}/editar` e
  `/admin/usuarios/{id}` (#110): com ID inexistente, malformado ou (no concurso) de outro usuário,
  a página de não encontrado saía com status 200, porque o `loading.tsx` já tinha começado o
  stream. A checagem passou para um layout do `[id]`, acima do esqueleto do detalhe, e os
  esqueletos das demais páginas foram para os grupos `(esqueleto)`, que não envolvem as rotas
  `[id]`. A checagem é uma leitura enxuta pela chave primária, já que o prefetch dos links para o
  detalhe agora passa por ela (e também pré-carrega o esqueleto do detalhe).
- **`SQLITE_BUSY` com banco local** (#112): duas escritas ao mesmo tempo (ex.: o registro de
  último acesso durante o cadastro de um concurso) disputavam o lock do arquivo e uma falhava na
  hora. Pior: a conexão da instrução que falhou ficava presa, fazendo falhar os COMMITs seguintes
  até o coletor de lixo liberá-la (o cadastro voltava "Não foi possível concluir a operação"). Com
  `file:`, o app agora faz uma escrita por vez no processo, usa WAL (leituras não disputam com
  escritas) e espera até 5 s pelo lock de outros processos (`pnpm mcp`, scripts). Turso não muda.
  Ao restaurar um backup copiando o arquivo, apague também `concurso.db-wal` e `concurso.db-shm`.

## [2.6.0] - 2026-11-08

### Adicionado

- **Painel do evento** (#100) no dashboard e no calendário: clicar num prazo abre os detalhes
  (concurso, status, situação, data, hora, local e próximos eventos) com as ações **Marcar como
  concluído**/**Reabrir**, **Ocultar do dashboard**/**Mostrar no dashboard**, **Editar** e **Ver
  no concurso**. No celular abre como gaveta inferior; no desktop, como diálogo. Se concluir o
  evento gera uma pergunta de status, ela aparece no próprio painel.
- **Concluir direto do dashboard** (#100): cada prazo tem o botão de concluir, com resposta
  imediata e aviso "Concluído — Desfazer". Ocultar passou para o painel, que explica a diferença:
  ocultar só tira do dashboard, o prazo continua pendente.
- **Link direto para o evento** (#100): prazos, próximas provas, notificações e o painel levam a
  `/concursos/{id}?aba=eventos&evento={id}`, com o evento rolado, focado e destacado por alguns
  segundos (sem animação com `prefers-reduced-motion`). O fim da validade leva ao card Validade
  (`?aba=geral&foco=validade`). Um id que não é do concurso sai da URL.
- **Voltar para a origem** (#100): vindo do dashboard, das notificações ou do calendário, o detalhe
  do concurso mostra "← Dashboard", "← Notificações" ou "← Calendário · novembro de 2026",
  preservando mês e filtro de concursos (`de`, `mes` e `concursos`, remontados por allowlist).
- **Avisos** (#100) com fila, expiração, pausa com o mouse ou o foco e `aria-live`, sem dependência
  nova: salvar e excluir concurso, eventos, links e resultados, concluir evento, responder
  pendência de status ("Status → X — Desfazer"), opções do feed `.ics` e o quadro por status. Com
  um diálogo aberto, o aviso aparece dentro dele, alcançável pelo teclado.
- **"Mudar status"** (#100) ao lado do badge no cabeçalho do concurso, com as transições
  permitidas, observação e "Desfazer última mudança"; `?mudar=status` (link da edição) já abre o
  diálogo.
- **"Salvar e adicionar outro"** (#100) ao criar um evento, e botão **Cancelar** no modal.
- **Alterações não salvas** (#100): no formulário do concurso e no modal de evento, sair por um
  link do app, Cancelar, Esc ou clique fora pede confirmação; fechar a aba usa o aviso do
  navegador.

### Alterado

- Concurso recém-cadastrado abre na aba **Eventos** (#100), com orientação para cadastrar as datas
  (inscrições, boleto, prova) que alimentam o dashboard, o calendário e os avisos.
- Cabeçalho do concurso (#100): só **Editar** e **Mudar status** ficam à vista; **Baixar eventos
  (.ics)**, **Silenciar notificações** e **Excluir…** foram para o menu **Mais ações** (⋯). A aba
  Histórico ficou só com a linha do tempo.
- Dashboard (#100): **Pendências de status** fica no topo, em largura total. "E mais N no
  calendário" virou **"Ver mais N a partir de <mês>"**, que abre o mês da 7ª prova.
- Situação do prazo unificada (#100): mesma regra e mesmo badge no dashboard e no calendário
  (Concluído > Vencido > Urgente > Esta semana > Prazo crítico). "Vencido" só vale para prazo
  crítico pendente; as cores de urgência são as mesmas nos prazos e nas próximas provas.
- No calendário, "Ir para o concurso" virou **"Ver no concurso"**.
- O **Desfazer** de status (aviso do quadro, do cabeçalho e da pendência) confere se a mudança
  ainda é a última; se o status mudou depois, nada é desfeito e o aviso explica.
- Erros de formulário levam o foco ao primeiro campo inválido; o checkbox de concluído da aba
  Eventos responde na hora e só trava o evento que está gravando.

### Corrigido

- **Cancelar** nos formulários de concurso usava "voltar" do navegador e saía do app quando a
  página era aberta direto ou recarregada; agora vai ao detalhe (edição) ou à lista (cadastro).
- O modal de evento devolve o foco ao botão que o abriu.

## [2.5.0] - 2026-11-05

### Adicionado

- **Logs da aplicação** (#91): logger estruturado próprio (`src/server/log.ts`, sem dependências),
  em JSON em produção e texto em dev, com `LOG_LEVEL` e `LOG_FORMAT`. Erros de servidor
  capturados pelo Next viram `requisicao.erro` via `onRequestError`, com rota, tipo e `digest`;
  erros inesperados das Server Actions e do MCP saem como `acao.erro` com a ação e o usuário.
  Novos eventos: logins (sucesso e falha), início de bloqueio por tentativas, tokens MCP/`.ics`
  inválidos, logout, importação, exportação e cada chamada de ferramenta MCP (nome, resultado e
  duração). Senhas, tokens, cookies, valores de query string e argumentos nunca são registrados;
  e-mails saem mascarados em qualquer texto, e os `params` das queries saem das mensagens de erro.
  No `pnpm --silent mcp` (stdio) todo log vai para o stderr, com teste do script real. Catálogo em
  `ARQUITETURA.md` §9.4.
- **Cabeçalhos de segurança** (#95) em todas as rotas, via `headers()` do `next.config.ts` (Vercel
  e Docker): `Content-Security-Policy` (só recursos da própria origem, fotos do Google,
  `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` (câmera, microfone, localização etc. desligados) e
  `Cross-Origin-Opener-Policy: same-origin`. Imagens externas no Markdown das observações deixam
  de carregar.
- **Limites nas entradas do MCP** (#96): tamanho máximo nos textos (os mesmos dos formulários,
  anunciados no JSON Schema), até 100 eventos e 50 links por chamada. A busca usa no máximo 200
  caracteres e 20 termos distintos em qualquer ponto de entrada.

### Alterado

- O login Google recusado não registra mais o e-mail completo (agora `r***@dominio`).
- Bloquear ou desbloquear um usuário apaga os tokens do MCP e do feed `.ics` dele (#96);
  desbloqueado, ele gera outros em Configurações.
- Sem login configurado, só o usuário inicial pode usar tokens do MCP e do feed (#96). Ao migrar
  de "sem login" para só Google, os tokens do usuário inicial param até o primeiro admin entrar.

### Corrigido

- **Tokens MCP e `.ics` de quem perdeu o acesso** (#96): continuavam valendo depois que o e-mail
  saía da lista de acesso (painel ou `ALLOWED_EMAILS`). Agora o token segue a mesma regra da
  sessão web, conferida a cada requisição: MCP responde 401 e o feed, 404.
- Uma busca com muitas palavras pelo MCP gerava erro de SQL (`Expression tree is too large`).

## [2.4.0] - 2026-11-03

### Adicionado

- Botão **Atualizar** (#77) no cabeçalho do celular e na barra lateral do desktop: busca de novo os
  dados da tela com `router.refresh()`, sem recarregar a página nem perder aba, scroll e diálogos
  abertos. Serve para ver o que o MCP ou outro aparelho alterou. Limite de uma vez por minuto,
  guardado no `sessionStorage` para valer em todas as páginas; na espera o botão fica com
  `aria-disabled` e o rótulo diz quanto falta. O ícone gira enquanto atualiza e um `aria-live`
  avisa "Dados atualizados". Sem refresh automático, polling ou realtime, para poupar as
  invocações do plano gratuito da hospedagem. Cada clique custa mais de uma requisição: o refresh
  limpa o cache do roteador e os links visíveis voltam a ser pré-carregados.
- A aba aberta no detalhe do concurso fica na URL (`?aba=links`, #77): recarregar a página (ou
  reabrir o PWA) mantém a aba, e voltar para a página pelo histórico também. A troca usa
  `history.replaceState`, sem requisição ao servidor nem entradas no histórico.

- **Contagem regressiva até a próxima prova** (#84): card "Próximas provas" no dashboard (até 6,
  da mais próxima para a mais distante) e aviso no topo da página do concurso ("Prova objetiva:
  faltam 12 dias", "é amanhã", "é hoje"). Destaque para hoje, amanhã e até 7 dias, com
  texto acessível para leitores de tela. Considera provas objetivas, discursivas e outras fases; não aparece para
  concursos encerrados, cancelados, com desistência ou suspensos.
- **Pendências de status** (#85): quando um evento importante chega ou passa (publicação do
  edital, fim das inscrições, vencimento do boleto, prova, resultado final, convocação/nomeação,
  posse), o dashboard e a página do concurso perguntam o que aconteceu ("Você se inscreveu?",
  "Fez a prova?", "Qual foi o resultado?"…) e a resposta muda o status com um clique, pela
  transição validada e com registro no histórico. "Lembrar depois" esconde a pergunta por 3 dias e
  "Não perguntar mais" a dispensa (migração `0006_pendencias_status`); se o evento for remarcado,
  a pergunta volta.
- **Calendário: navegação rápida e filtro de concursos** (#83). Clicar no título do mês abre um
  seletor com os 12 meses do ano e a quantidade de eventos de cada um, com setas para trocar de ano:
  qualquer mês fica a dois ou três toques, no desktop e no celular. Atalhos "Próximos eventos"
  (próximo mês com eventos) e "Próxima prova" (com a contagem regressiva do #84). A legenda de
  concursos virou filtro: cada concurso liga e desliga com um clique (`aria-pressed`), com "só
  este" e "Mostrar todos". Mês e seleção ficam na URL (`?mes=2026-11&concursos=1,3`), que continua
  compartilhável, e a seleção se mantém ao trocar de mês.

### Alterado

- A sugestão de status (#65) virou uma das pendências de status (#85): o botão "Aplicar" deu
  lugar às respostas da pergunta, e o histórico registra "Pendência: …" em vez de "Sugestão: …".
- Um único sino de notificações por tela (#78): o card "Próximos prazos" do dashboard perdeu o
  sino próprio, que repetia o da navegação (cabeçalho no celular, barra lateral no desktop) com o
  mesmo contador. O dashboard deixa de calcular as não lidas, que já vêm do layout.
- No celular, o seletor de tema passa para dentro do menu da conta (Claro / Escuro / Sistema), o
  que libera espaço no cabeçalho de 360 px e devolve o nome do app ao lado do ícone. No desktop o
  seletor continua na barra lateral.
- Sem opções duplicadas (#82): a seção Aparência saiu de Configurações (o tema fica só junto ao
  avatar: barra lateral no desktop, menu da conta no celular) e o link Configurações saiu do menu
  da conta (fica na navegação principal).

### Corrigido

- Barra de navegação/gestos do Android branca no tema escuro (#81): o `<html>` passa a ter o
  fundo do tema (área atrás da barra com `viewport-fit=cover`) e o layout declara
  `<meta name="color-scheme" content="light dark">`, além do `color-scheme` que o script de tema
  já aplicava no `<html>`.

## [2.3.0] - 2026-11-02

### Adicionado

- Guia visual da arquitetura (`docs/GUIA-ARQUITETURA.md`): diagramas Mermaid das camadas, do
  fluxo de leitura e de gravação, da máquina de status, dos lembretes, do modelo de dados, da
  autenticação multiusuário, do MCP, da inicialização, do deploy e da CI, além de um mapa
  "onde mexo para…" e glossário. Linkado no README e em `ARQUITETURA.md`.
- Esqueletos de carregamento (`loading.tsx`, #73) no app e no painel admin, com formas próprias
  para o detalhe do concurso e o calendário: ao clicar na navegação a tela troca na hora, em vez
  de ficar parada até a resposta do servidor.

### Alterado

- Mutações com uma viagem só ao servidor (#73): os componentes deixaram de chamar
  `router.refresh()` depois das Server Actions, que já revalidam e devolvem a tela (layout e sino
  inclusos) na mesma resposta. Criar, editar e excluir concurso passam a redirecionar na própria
  action. Ficam com refresh a importação de backup (`POST /api/import`) e as falhas ao mover ou
  desfazer no quadro.
- Com os esqueletos, o detalhe de um concurso inexistente responde 200 (com `noindex`) em vez de
  404, porque o stream começa antes da página rodar.
- Documentação revisada contra o código da v2.2.0:
  - `REQUISITOS.md`: multiusuário, lembretes e PWA saem de "fora do escopo"; usuário-alvo,
    RNF03/RNF06 e as questões em aberto passam a refletir as decisões tomadas.
  - `ARQUITETURA.md`: estrutura de pastas atualizada (componentes, domínio, `lib`, scripts,
    `instrumentation.ts`); ordem real das Server Actions (sessão → Zod → `executar`); export CSV
    só de concursos e import que sempre substitui tudo; jobs de CI (e2e sempre, imagem Docker com
    smoke test) e `release.yml` sem imagem no GHCR; `jose` na stack.
  - README: menção ao multiusuário e ao PWA, link para o guia visual, rotas públicas completas,
    aviso da Vercel de volta à seção da Vercel, notas do Docker com login Google, uso do `APP_URL`
    no `.ics` e retorno da `release/*` para `develop` por PR.
  - `REQUISITOS.md` RF09: CSV só dos concursos.
  - `.env.example`: lista completa das rotas que não exigem sessão.

## [2.2.0] - 2026-11-01

### Adicionado

- Lembretes (RF08, #65), sem e-mail (decisão: o resumo diário por e-mail não será desenvolvido):
  - **Notificações no app**: sino com contador de não lidas na navegação (lateral no desktop,
    cabeçalho no celular) e no dashboard, e central em `/notificacoes` com marcar como lida,
    marcar todas e dispensar. Calculadas sob demanda a partir dos eventos pendentes, das regras e
    de "hoje" (Brasília), sem cron; uma notificação é o par (prazo, antecedência), então mudar a
    data do evento não a duplica. Eventos concluídos e concursos encerrados não notificam.
  - **Regras de notificação** em Configurações → Notificações: por tipo de evento (inclusive o fim
    da validade), ligar/desligar e as antecedências em dias (0 = no dia), com padrão pronto e
    "Restaurar padrão". **Silenciar** um concurso no detalhe dele cala os avisos e os alarmes só
    daquele concurso.
  - **Calendário .ics** (RFC 5545): feed assinável (`webcal://`) em `/api/calendario.ics?token=…`,
    com token pessoal (só o SHA-256 fica no banco), revogável e regenerável em Configurações →
    Calendário; usuário bloqueado perde o acesso. Opções: incluir eventos concluídos e de
    concursos encerrados. Download manual de todos os concursos (Configurações) e de um só (botão
    **.ics** no detalhe), via `/api/export?formato=ics[&concurso=<id>]`. Eventos sem hora são de dia
    inteiro; com hora, convertidos de Brasília para UTC; `UID` estável por evento; pseudo-evento do
    fim da validade; `VALARM` nos prazos críticos pendentes com as antecedências das regras.
  - **Sugestão de status** no detalhe do concurso e no dashboard: prova passada → "Prova
    realizada"; prazo de recurso (após a prova) encerrado → "Aguardando resultado"; inscrito com
    prova marcada → "Prova agendada". Só sugere; "Aplicar" usa a transição validada e grava o
    motivo no histórico.
  - No cabeçalho do celular, abaixo de 400 px, o nome do app fica só para leitores de tela (o
    ícone continua), para o sino caber ao lado do tema e do menu da conta.
  - Migração `0005_lembretes`: tabelas `regra_notificacao` e `notificacao_estado`, e as colunas
    `concurso.notificacoes_silenciadas` e `usuario.ics_token_hash`/`ics_incluir_concluidos`/
    `ics_incluir_encerrados`. O backup JSON (ainda `schemaVersion` 1) passa a levar
    `regrasNotificacao`, `notificacoes` (lidas/dispensadas) e `concursos[].notificacoesSilenciadas`,
    todos opcionais; na importação, os eventos recebem IDs novos e o estado é religado a eles.

- App instalável (PWA, #66): Web App Manifest (`/manifest.webmanifest`, `display: standalone`),
  ícones PNG 192/512 e maskable, `apple-icon.png` e `appleWebApp` para o iOS, e `theme-color` que
  segue o tema efetivo (do sistema ou escolhido no app), para a barra de status combinar. No Android, o
  Chrome passa a oferecer "Instalar app", que abre em tela cheia, sem a barra de URL. Manifest e
  ícones ficam acessíveis sem login. **Quem já tinha o atalho antigo na tela inicial precisa
  removê-lo e instalar de novo.**
- Novo logo (escudo com visto, seta de crescimento e livro), fonte única em `assets/logo.svg`; os
  ícones são gerados por `pnpm icones` (`sharp`, só em desenvolvimento).

### Corrigido

- Responsividade em celulares de ~360 px (#48): a lista de concursos com nome ou cargo longo e as
  tabelas do painel admin (`/admin/usuarios`, auditoria) não fazem mais a página rolar na
  horizontal; em telas de toque, botões, campos, abas e o seletor de tema têm alvos de 36–40 px.
  O cabeçalho do celular respeita as áreas seguras (notch) no app instalado, e na visão admin
  esconde o nome do app abaixo de 400 px para caber o selo "Admin".

## [2.1.0] - 2026-11-01

### Adicionado

- Suporte às variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (#62), injetadas pela integração
  do Turso no Marketplace da Vercel, como alternativa a `DATABASE_URL`/`DATABASE_AUTH_TOKEN`. A
  prioridade é `DATABASE_*` > `TURSO_*` > SQLite local (string vazia conta como não definida), e
  vale para o app, `pnpm db:migrate` (que roda no build), `db:backup`, `mcp` e `drizzle-kit`.
  Antes, com só as `TURSO_*` definidas, o app caía no SQLite local, que é efêmero na Vercel.

## [2.0.0] - 2026-11-01

### Adicionado

- Login com Google e multiusuário (#49): OIDC próprio com `jose` (código de autorização + PKCE,
  `state` e `nonce`), acesso por allowlist (`ADMIN_EMAILS` + `ALLOWED_EMAILS`) conferida no login
  e a cada requisição. Nova tabela `usuario` e `concurso.usuario_id`: cada usuário vê e altera só
  os próprios concursos (e links, eventos, histórico, resultados e anexos); tags são um vocabulário
  compartilhado, mas cada um vê só as suas. Exportar/importar passam a valer só para os dados do
  usuário, com IDs renumerados na importação. Migração `0003_multiusuario`: o usuário inicial
  (ID 1, admin) fica dono dos dados existentes e é assumido pelo primeiro login Google de um e-mail
  de `ADMIN_EMAILS`.
- Token pessoal do MCP (#49) em Configurações → Token do MCP; o banco guarda só o SHA-256. O MCP
  por stdio usa o usuário inicial.
- Painel administrativo (RF11, #50) em `/admin`, para usuários com papel `ADMIN`: seletor
  “Visão usuário ↔ Visão admin” no novo menu da conta (avatar), sem novo login, salvo no cookie
  `concurso_visao`, com faixa “Modo admin” na visão admin. Visão geral com totais; lista de
  usuários (nome, e-mail, papel, cadastro, último acesso, nº de concursos) com promover/rebaixar
  e bloquear/desbloquear — o bloqueado perde o acesso na hora (login, sessão aberta e token do
  MCP); e-mails liberados pelo painel (tabela `email_permitido`), somados às env vars; log de
  auditoria das ações (`auditoria_admin`). A autorização é sempre pelo papel relido do banco, com
  403 para não admins, e não é possível rebaixar nem bloquear o último admin ativo. Migração
  `0004_painel_admin`.

### Alterado

- **Incompatível:** `MCP_TOKEN` foi removido; o `/api/mcp` exige o token pessoal do usuário
  (`Authorization: Bearer`). Gere um novo token em Configurações e atualize os clientes MCP.
- **Incompatível:** em produção, `APP_PASSWORD` não pode coexistir com o login Google; a senha
  única fica para uso local. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e
  `ADMIN_EMAILS` (e opcionalmente `ALLOWED_EMAILS`) antes de atualizar (passo a passo no README).

## [1.3.0] - 2026-11-01

### Adicionado

- Tema claro, escuro e do sistema (#47): seletor Claro / Escuro / Sistema na navegação (lateral no
  desktop, cabeçalho no celular) e em Configurações → Aparência. Padrão Sistema (segue
  `prefers-color-scheme`, inclusive mudanças ao vivo); a escolha fica salva no navegador e é
  aplicada por um script inline no `<head>` antes da primeira pintura, sem flash de tema errado.
  O tema escuro passa a usar a classe `dark` no `<html>`, e os destaques de atenção (prazo da
  semana, validade vencendo, suspenso, sub judice) usam os tokens `--aviso`/`--aviso-foreground`,
  com contraste adequado nos dois temas; o fundo dos diálogos escurece mais no tema escuro.
- Ocultar e reexibir prazos no dashboard (RF06, #44): cada item da lista de próximos prazos tem
  um botão de olho para ocultá-lo; o cabeçalho mostra o contador “N ocultos” e o botão “Mostrar
  ocultos” (`/?ocultos=1`), que exibe os ocultos esmaecidos, com selo “Oculto” e a ação de
  reexibir. Vale também para o pseudo-evento de fim da validade. A preferência é gravada no banco
  (migração `0001_dashboard_ocultos`: `evento.oculto_dashboard` e
  `concurso.validade_oculta_dashboard`), persiste entre sessões e não altera `updated_at`; o
  calendário e o MCP continuam listando todos os prazos (`proximos_prazos` informa
  `ocultoNoDashboard`). O backup JSON inclui os novos campos sem mudar o `schemaVersion` (1):
  backups antigos, sem eles, são importados com tudo visível.
- Cor e ícone por concurso (#46): no formulário, cor de uma paleta pré-definida (azul, ciano,
  verde-água, verde, violeta, magenta, rosa, cinza) ou “Automática” — derivada do ID, sempre a
  mesma — e, opcionalmente, um emoji como ícone. Calendário (grade, agenda e diálogo de detalhes),
  próximos prazos do dashboard, lista, quadro e detalhe do concurso mostram um marcador com a cor
  e o ícone, sem tirar o destaque vermelho/âmbar dos prazos críticos; o calendário ganha a
  legenda cor → concurso. A paleta usa tokens CSS com tons próprios para os temas claro e
  escuro (contraste ≥ 3:1, verificado em teste). Migração `0002_cor_icone_concurso`
  (`concurso.cor` e `concurso.icone`); backup JSON com os campos opcionais sem mudar o
  `schemaVersion` (1) e MCP aceitando/retornando `cor` e `icone`.

### Alterado

- Calendário (#45): clicar num evento (grade do mês ou agenda em lista no celular) abre um diálogo
  com os detalhes em vez de navegar — nome, data e horário, local, concurso (órgão, cargo e
  status), situação (concluído, urgente, vencido) e os próximos eventos pendentes do concurso no
  mês — e o botão “Ir para o concurso”. Fecha com Esc, clique fora ou botão Fechar, devolvendo o
  foco ao evento; acessível por teclado (Radix Dialog).

### Corrigido

- Observações do concurso: tabelas em markdown voltam a ser renderizadas como tabela (#43), em vez
  de texto cru (`| a | b |`). O `react-markdown` passa a usar `remark-gfm`, o que também habilita
  tachado, listas de tarefas e autolinks. A tabela tem bordas, padding e cabeçalho destacado com as
  cores do tema, e tabelas largas rolam na horizontal sem quebrar o layout. HTML bruto continua
  descartado (`skipHtml`) e URLs perigosas continuam neutralizadas.

## [1.2.0] - 2026-11-01

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
