# Requisitos — App de Controle de Concursos

## 1. Visão geral

Aplicação web simples, de uso pessoal, para cadastrar e acompanhar concursos públicos
ao longo de todo o ciclo de vida: desde o "radar" (concurso previsto) até a nomeação/posse.
O objetivo é centralizar links de editais, datas importantes, status e anotações, e
deixar claro "o que vem a seguir" em cada concurso.

## 2. Escopo

**Dentro do escopo (MVP)**
- CRUD de concursos com seus dados principais, datas, links e anotações.
- Acompanhamento de status (pipeline pré e pós-prova).
- Visão de próximos prazos/eventos.
- Filtros e busca.

**Incorporado depois do MVP**
- Multiusuário com login Google e painel de administração (#49, #50; RF11): cada usuário vê só
  os próprios concursos — não há compartilhamento de concursos entre usuários.
- Lembretes no app e calendário .ics (RF08, #65) e app instalável no celular (PWA, #66).

**Fora do escopo (por enquanto)**
- Compartilhamento de concursos entre usuários.
- Lembretes por e-mail (decisão de 2026-11-01; ver RF08).
- Raspagem automática de sites de bancas ou importação automática de editais (o cadastro
  assistido por LLM do RF10 parte do edital que o usuário fornece).
- Plano de estudos detalhado (cronograma por matéria, questões, etc.).
- App mobile nativo (a web é responsiva e instalável como PWA).

## 3. Usuário

Pensado para uso pessoal: localmente, um único usuário (o dono do app), sem login ou com senha
única. Hospedado, admite poucos usuários com login Google e allowlist de e-mails (#49), cada um
com os próprios dados; admins administram a instância (RF11).

## 4. Requisitos funcionais

### RF01 — Cadastro de concurso
Campos:
| Campo | Tipo | Obrigatório |
|---|---|---|
| Nome / órgão (ex.: "TRF 3ª Região") | texto | sim |
| Cargo(s) / área | texto | sim |
| Banca organizadora (ex.: FCC, Cebraspe, FGV) | texto | não |
| Esfera (federal, estadual, municipal) e UF/cidade | enum + texto | não |
| Escolaridade exigida | enum (médio, superior, …) | não |
| Remuneração inicial | moeda (BRL) | não |
| Nº de vagas (ampla / cadastro de reserva / cotas) | inteiro(s) | não |
| Valor da taxa de inscrição | moeda (BRL) | não |
| Status | enum (ver RF03) | sim |
| Tags livres (ex.: "prioridade", "tribunais") | lista | não |
| Observações gerais | texto longo (markdown) | não |
| Cor de identificação (paleta pré-definida; padrão automático pelo ID) e ícone (emoji) (#46) | enum + texto | não |

### RF02 — Links e documentos
- Cada concurso pode ter N links com rótulo e tipo: edital de abertura, retificação,
  página da banca, área do candidato, gabarito, resultado, convocação, outros.
- Opcional (desejável): anexar arquivos (PDF do edital, comprovantes).

### RF03 — Status / pipeline
Status sugeridos, em ordem:
1. **Previsto** (autorizado/comissão formada, sem edital)
2. **Edital publicado**
3. **Inscrito** (inscrição feita, taxa paga ou isenção deferida)
4. **Prova agendada / local divulgado**
5. **Prova realizada**
6. **Aguardando resultado** (gabarito, recursos)
7. **Aprovado** / **Classificado** / **Reprovado**
8. **Nomeado** → **Empossado**
- Status terminais adicionais: **Desistiu**, **Não inscrito**, **Concurso cancelado/suspenso**.
- Registrar histórico de mudanças de status com data.

### RF04 — Datas e eventos
- Cada concurso possui N eventos datados com tipo: publicação do edital, início/fim
  das inscrições, pedido de isenção, vencimento do boleto, prova objetiva, prova
  discursiva/outras fases (TAF, títulos, psicotécnico, investigação social), gabarito
  preliminar, prazo de recursos, resultado final, homologação, convocação, nomeação, posse,
  validade do concurso.
- Evento pode ter hora, local e observação; pode ser marcado como concluído.

### RF05 — Dados pós-prova
- Nota obtida por fase, nota de corte, classificação (geral e na lista de cotas, se houver).
- Situação após cada fase.
- Prazo de validade do concurso (e prorrogação) para acompanhar convocações.

### RF06 — Painel (dashboard)
- Lista de próximos eventos (ex.: próximos 30 dias), destacando prazos críticos
  (fim de inscrição, vencimento de boleto, provas, prazos de recurso).
- Contagem de concursos por status.
- Ocultar/reexibir eventos individualmente da lista de próximos prazos, com contador de ocultos e
  opção "mostrar ocultos"; a escolha persiste entre sessões (#44).
- Visão em lista e, desejável, visão em quadro (kanban por status) e calendário.
- Concursos identificados pela cor/ícone (RF01) no calendário (com legenda cor → concurso), no
  painel, na lista e no quadro, sem prejudicar o destaque de prazos críticos e com contraste
  adequado nos temas claro e escuro (#46).

### RF07 — Busca e filtros
- Buscar por nome, cargo, banca, tags.
- Filtrar por status, esfera, UF, escolaridade, faixa de remuneração.
- Ordenar por próxima data, remuneração, data de cadastro.

### RF08 — Lembretes (pós-MVP, entregue na v2.2.0)
- Notificação de prazos próximos ~~(e-mail ou notificação do navegador)~~ — no próprio app, com regras
  configuráveis por tipo de evento (#65). E-mail fora do escopo (decisão de 2026-11-01).
- Exportar eventos para calendário (.ics), inclusive como feed assinável.
- Sugerir o próximo status quando um evento-chave passa (sem alterar sozinho).

### RF09 — Exportação / backup
- Exportar todos os dados em JSON e/ou CSV; importar a partir do JSON.

### RF10 — Cadastro assistido por LLM (MCP)
- Servidor MCP para que uma LLM com acesso ao edital (anexado pelo usuário) cadastre e atualize
  concursos: o usuário escolhe o cargo e a LLM preenche os dados daquele cargo, o cronograma
  (eventos), links e tags numa única operação, após mostrar um resumo para confirmação.
- Atualizações: retificações (eventos existentes alterados sem duplicar), status com histórico,
  resultados por fase; consultas a concursos e prazos.
- Sem operações de exclusão pelo MCP. Uso local por stdio; hospedado por HTTP com token próprio.

### RF11 — Administração da instância (#50)
- Com multiusuário (#49), usuários com papel admin têm um painel (`/admin`) para listar usuários
  (nome, e-mail, papel, cadastro, último acesso, nº de concursos), promover/rebaixar admins,
  bloquear/desbloquear contas, gerenciar a allowlist do login Google e ver totais da instância e o
  log de auditoria das ações administrativas.
- O admin alterna entre "Visão admin" e "Visão usuário" sem novo login; na visão usuário vê o mesmo
  app que qualquer usuário. A autorização é sempre pelo papel no servidor; nunca pode faltar um
  admin ativo. Sem impersonação: o admin não vê os dados dos outros usuários.

## 5. Requisitos não funcionais

- **RNF01 — Simplicidade:** stack enxuta, fácil de rodar localmente com um comando.
- **RNF02 — Persistência:** dados persistidos de forma confiável (ex.: SQLite) e
  fáceis de fazer backup.
- **RNF03 — Responsividade:** usável no celular (alvo: 360 px sem rolagem horizontal) e
  instalável como PWA (#48, #66).
- **RNF04 — Idioma/locale:** interface em português (pt-BR), datas `dd/mm/aaaa`,
  moeda em BRL, fuso `America/Sao_Paulo`.
- **RNF05 — Desempenho:** volume pequeno (dezenas a centenas de concursos); sem
  necessidade de escalabilidade.
- **RNF06 — Segurança:** se hospedado, exigir login (o servidor recusa iniciar em produção sem
  login, salvo opt-out explícito); cada usuário acessa só os próprios dados; links externos
  abertos com `rel="noopener noreferrer"`.
- **RNF07 — Qualidade:** testes automatizados das regras de domínio (status, datas)
  e lint/format padronizados.
- **RNF08 — Deploy:** possibilidade de hospedar gratuitamente/barato (desejável).

## 6. Processo de desenvolvimento

- **Gitflow:**
  - `master` — apenas versões liberadas (tags `vX.Y.Z`).
  - `develop` — integração.
  - `feature/<nome>` — a partir de `develop`, merge de volta em `develop` via PR.
  - `release/<versão>` — a partir de `develop`, merge em `master` e `develop`.
  - `hotfix/<nome>` — a partir de `master`, merge em `master` e `develop`.
- Commits pequenos e descritivos; PRs revisados antes do merge.
- Versionamento semântico.

## 7. Questões em aberto

Decisões registradas em [`ARQUITETURA.md` §11](./ARQUITETURA.md#11-riscos-e-decisões-pendentes-seção-7-dos-requisitos):

1. ~~O app será apenas local ou hospedado (exige autenticação)?~~ **Ambos:** local-first, com
   hospedagem opcional (Vercel + Turso ou Docker) e login obrigatório em produção.
2. Anexos de arquivos entram no MVP ou só links? **Só links no MVP**; anexos seguem planejados
   (M7).
3. ~~Lembretes por e-mail são desejáveis desde o início?~~ **Não serão feitos** (2026-11-01): o
   feed .ics e as notificações no app cobrem o caso.
