<img src="assets/icon.svg" width="64" height="64" alt="">

# concurso

App pessoal para cadastrar e acompanhar concursos públicos — do "radar" até a posse: dados do
edital, status com histórico, datas importantes (inscrição, boleto, provas, recursos), dashboard de
próximos prazos, busca e filtros, resultados por fase, validade do concurso e backup/restauração.
[Lembretes](#lembretes-notificações-e-calendário) avisam dos prazos no app e no calendário do
celular (feed .ics). Com o [servidor MCP](#cadastro-pelo-edital-com-uma-llm-mcp), uma LLM lê o
edital e faz o cadastro.

Feito para **uso pessoal**: roda localmente com um comando (SQLite em arquivo) e, se quiser, pode
ser hospedado de graça (Vercel + Turso) ou em um container Docker. Hospedado, aceita
[login com Google](#autenticação) para você e quem mais liberar — cada pessoa vê só os próprios
concursos — e pode ser [instalado no celular](#instalar-no-celular-pwa) como app.

Documentação: [requisitos](docs/REQUISITOS.md) · [arquitetura](docs/ARQUITETURA.md) ·
[guia visual da arquitetura](docs/GUIA-ARQUITETURA.md) · [changelog](CHANGELOG.md).

## Início rápido

Requisitos: Node.js 24 LTS ou superior (veja `.nvmrc`) e pnpm (versão em `packageManager` no
`package.json`; ex.: `npm i -g pnpm` ou `corepack enable`).

```bash
pnpm install && pnpm dev     # http://localhost:3000
```

O `pnpm dev` aplica as migrações pendentes e cria o banco em `data/concurso.db` (fora do Git). Para
ter dados de exemplo fictícios: `pnpm db:seed`.

Uso diário em modo produção local (sem senha, só nesta máquina):

```bash
pnpm build
ALLOW_NO_AUTH=true pnpm start   # ou defina ALLOW_NO_AUTH=true no .env.local
```

Em produção o app **recusa iniciar sem login configurado**, a menos que `ALLOW_NO_AUTH=true` — veja
[Autenticação](#autenticação).

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e ajuste. Nada é obrigatório para rodar localmente.

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `file:./data/concurso.db` | Banco libSQL: arquivo SQLite local ou `libsql://<banco>.turso.io` |
| `DATABASE_AUTH_TOKEN` | — | Token do Turso (só com `libsql://`) |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | — | Alternativas a `DATABASE_URL` / `DATABASE_AUTH_TOKEN` (que têm prioridade), já injetadas pela integração do Turso na Vercel |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Liga o login com Google (multiusuário) |
| `ADMIN_EMAILS` | — | E-mails dos admins (obrigatório com o login Google); o primeiro a entrar assume os dados existentes |
| `ALLOWED_EMAILS` | — | Allowlist: demais e-mails que podem entrar com Google (separados por vírgula) |
| `APP_PASSWORD` | — | Login por senha única, **para uso local** (entra como o usuário inicial) |
| `AUTH_SECRET` | — | Segredo (≥ 32 bytes) que assina a sessão; obrigatório com qualquer login |
| `APP_URL` | — | Origem pública (ex.: `https://concursos.exemplo.com`) para a URL de callback do Google, se o app estiver atrás de proxy |
| `ALLOW_NO_AUTH` | `false` | `true` permite rodar em produção sem login (uso local, sem exposição) |
| `MIGRATE_ON_START` | `false` | `true` aplica as migrações ao iniciar o servidor (já ligado na imagem Docker) |
| `BACKUP_KEEP` | `10` | Quantos backups o `pnpm db:backup` mantém |

## Autenticação

O app é **multiusuário**: cada concurso pertence a um usuário, e cada um vê e altera só os próprios
dados (inclusive export/import e MCP).

- **Sem login configurado**: sem login (uso local); tudo pertence ao usuário inicial.
- **Login com Google** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`, `AUTH_SECRET`):
  só entram os e-mails de `ADMIN_EMAILS` e `ALLOWED_EMAILS` (allowlist). Os dados que existiam
  antes do multiusuário pertencem ao **usuário inicial**, que é assumido pelo primeiro login de um
  e-mail de `ADMIN_EMAILS`. Retirar um e-mail da allowlist encerra as sessões dele na hora.
- **Painel admin** (`/admin`, só admins): lista os usuários, promove/rebaixa admins, bloqueia
  contas (sem acesso por sessão nem pelos tokens do MCP e do calendário), libera e-mails além dos
  de `ALLOWED_EMAILS` e registra tudo num log de auditoria. O admin alterna entre "Visão admin" e "Visão usuário" no
  menu da conta, sem novo login. Os e-mails de `ADMIN_EMAILS` são admins garantidos, e o último
  admin ativo não pode ser rebaixado nem bloqueado.
- **Senha única** (`APP_PASSWORD` + `AUTH_SECRET`): para uso local; entra sempre como o usuário
  inicial. Em produção não pode ser combinada com o login Google. Após 5 senhas erradas, novas
  tentativas do mesmo cliente esperam cada vez mais.
- Com login, todas as páginas e APIs exigem sessão, exceto `/login`, `/api/health`, o fluxo do
  Google em `/api/auth/google…`, o manifest e os ícones do PWA e `/api/mcp` e
  `/api/calendario.ics` (que usam token próprio). A sessão fica em um cookie JWT assinado
  (`httpOnly`, `SameSite=Lax`, `Secure` em produção) válido por 30 dias; "Sair" fica no menu da
  conta e em **Configurações**.
- Gere o segredo com `openssl rand -base64 32` (ou
  `node -e "console.log(crypto.randomBytes(32).toString('base64'))"`). Trocar o `AUTH_SECRET`
  encerra todas as sessões.
- Em produção (`NODE_ENV=production`) o servidor não inicia sem login, salvo `ALLOW_NO_AUTH=true`,
  nem com `AUTH_SECRET` curto, Google sem `ADMIN_EMAILS` ou Google junto com `APP_PASSWORD`.
- Hospedado, use sempre HTTPS (o cookie de sessão é `Secure` em produção; `localhost` é exceção
  nos navegadores).

### Configurar o login com Google

1. No [Google Cloud Console](https://console.cloud.google.com), crie (ou escolha) um projeto.
2. Em **Google Auth Platform → Branding**, preencha nome do app e e-mail de suporte. Em
   **Audience**, escolha *External*. Enquanto o app estiver em *Testing*, só entram as contas
   listadas em *Test users* (até 100); para outras pessoas, publique o app (*In production*). Com
   os escopos básicos (`openid`, `email`, `profile`) não há revisão de verificação.
3. Em **Clients → Create client**, tipo *Web application*:
   - *Authorized JavaScript origins*: `http://localhost:3000` e `https://<seu-domínio>`;
   - *Authorized redirect URIs*: `http://localhost:3000/api/auth/google/callback` e
     `https://<seu-domínio>/api/auth/google/callback`.
4. Copie o *Client ID* e o *Client secret* para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, defina
   `ADMIN_EMAILS` (o seu e-mail) e, se quiser liberar outras pessoas, `ALLOWED_EMAILS`.

O Google não aceita curingas nas redirect URIs: os *preview deploys* da Vercel (URL diferente a
cada deploy) não conseguem fazer login com Google. Use um domínio fixo de produção.

## Backup e restauração

**Export/import JSON (qualquer banco).** Em **Configurações**: "Baixar backup (JSON)" gera um
arquivo versionado com todos os seus dados (concursos, tags, links, eventos, histórico,
resultados, regras de notificação e o que já foi lido); "Baixar concursos (CSV)" gera uma
planilha (separador `;`, abre direto no Excel/LibreOffice). "Importar…" restaura um
backup JSON **substituindo todos os seus dados** (com confirmação; tudo ou nada) — os de outros
usuários não são tocados, e os IDs são renumerados. Também serve para migrar entre local ↔
hospedado.

**Cópia do arquivo SQLite (banco local).**

```bash
pnpm db:backup               # backups/concurso-AAAAMMDD-HHmm.db (mantém os 10 mais recentes)
pnpm db:backup --manter=30   # ou BACKUP_KEEP=30
```

Usa `VACUUM INTO` (cópia consistente mesmo com o app aberto). A pasta `backups/` fica fora do Git —
dados pessoais nunca vão para o repositório. Para restaurar: pare o app e copie o arquivo do backup
para `data/concurso.db` (ou o caminho de `DATABASE_URL`).

No Docker o banco fica no volume: com o container parado, `docker cp concurso:/app/data/concurso.db .`
copia o arquivo (e o caminho inverso restaura); ou use o export JSON. No Turso, use o point-in-time
restore do serviço e o export JSON periódico.

## Lembretes: notificações e calendário

**Notificações no app.** O sino (na navegação e no dashboard) conta os avisos não lidos e leva à
central (`/notificacoes`), onde cada aviso pode ser marcado como lido ou dispensado. Os avisos são
calculados na hora a partir dos eventos pendentes — não há cron, então funciona até localmente — e
seguem as **regras de notificação** de **Configurações → Notificações**: para cada tipo de evento,
ligar/desligar e as antecedências em dias (0 = no dia). O padrão: fim das inscrições em 7, 1 e 0
dias; isenção e boleto em 2 e 0; provas e demais fases em 7 e 1; recursos em 1 e 0; convocação,
nomeação e posse em 3 e 0; fim da validade em 90 e 30. "Restaurar padrão" desfaz as mudanças. No
detalhe do concurso, **Silenciar** cala os avisos e alarmes só daquele concurso. Eventos concluídos
e concursos encerrados não notificam. Se a data de um evento muda (retificação), o aviso acompanha
a nova data, sem duplicar.

**Calendário (.ics).** Em **Configurações → Calendário**, "Gerar link de assinatura" cria um link
pessoal (`/api/calendario.ics?token=…`, exibido uma única vez; o banco guarda só o resumo
SHA-256). Assine-o no Google Calendar (*Outras agendas → + → Do URL*), no Apple Calendar (botão
"Assinar", que abre o `webcal://`) ou no Outlook: o calendário do celular passa a mostrar os prazos
e notifica de graça. Eventos sem hora entram como dia inteiro; com hora, no horário de Brasília;
prazos críticos pendentes (inscrição, isenção, boleto, provas, recursos, posse) levam alarmes com as
antecedências das regras de notificação. Cada evento tem um identificador estável, então mudanças
no app aparecem na próxima sincronização (o Google leva até algumas horas) sem duplicar. Opções:
incluir eventos concluídos e eventos de concursos encerrados. Gerar um novo link ou revogar invalida
o anterior; quem tiver o link vê seus prazos, então não o compartilhe. Sem assinatura, baixe o
`.ics` de todos os concursos (Configurações) ou de um só (botão **.ics** no detalhe do concurso).

**Sugestão de status.** Quando um evento-chave passa, o detalhe do concurso e o dashboard sugerem o
próximo status (ex.: prova realizada → "Prova realizada"; fim do prazo de recurso → "Aguardando
resultado"; inscrito com prova marcada → "Prova agendada"). Nada muda sozinho: "Aplicar" faz a
transição normal e registra o motivo no histórico.

## Cadastro pelo edital com uma LLM (MCP)

O app é também um servidor [MCP](https://modelcontextprotocol.io): conectado a um cliente como o
Claude Desktop ou o Claude Code, a LLM lê o edital (PDF anexado na conversa ou texto), você escolhe
o cargo e ela cadastra o concurso de uma vez — dados do cargo, cronograma (eventos), links e tags —,
mostrando um resumo para você confirmar antes de gravar. Também aplica retificações, muda o status
(com histórico), registra resultados e responde sobre prazos e concursos cadastrados.

**Não há ferramentas de exclusão**: excluir concursos, eventos, links ou resultados é só pela
interface. A LLM não baixa o edital sozinha: anexe-o (ou cole o texto) na conversa.

| Ferramenta | O que faz |
|---|---|
| `cadastrar_concurso` | Concurso (um cargo) + eventos + links + tags, tudo ou nada; `simular: true` só valida e mostra |
| `verificar_duplicado` | Procura concursos com órgão e cargo parecidos (o cadastro também recusa duplicados) |
| `atualizar_concurso` | Altera só os campos informados (`null` limpa) |
| `alterar_status` | Troca de status validada, com histórico (informa os status permitidos quando recusa) |
| `salvar_eventos` / `salvar_links` | Cria e altera em lote (ex.: cronograma de uma retificação) |
| `registrar_resultado` | Nota, corte, classificação e situação em uma fase |
| `listar_concursos` / `obter_concurso` / `proximos_prazos` | Consultas |

Recursos: `concurso://referencia` (valores aceitos e transições de status) e
`concurso://concursos/{id}` (ficha). Prompts: `cadastrar_edital` (guia a extração de um cargo) e
`aplicar_retificacao`.

**Local (stdio)** — usa o mesmo banco do app (`DATABASE_URL` do `.env.local`), com os dados do
usuário inicial. O `--silent` é necessário: o protocolo usa o stdout.

```bash
# Claude Code
claude mcp add concurso -- pnpm --silent --dir /caminho/para/concurso mcp
```

```json
// Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "concurso": {
      "command": "pnpm",
      "args": ["--silent", "--dir", "/caminho/para/concurso", "mcp"]
    }
  }
}
```

**Hospedado (HTTP)** — em **Configurações → Token do MCP**, gere o seu token pessoal (ele aparece
só uma vez) e conecte o cliente a `https://<seu-app>/api/mcp` com o header
`Authorization: Bearer <token>`:

```bash
claude mcp add --transport http concurso https://<seu-app>/api/mcp \
  --header "Authorization: Bearer $TOKEN"
```

O token dá acesso apenas aos dados de quem o gerou; o banco guarda só o resumo SHA-256. Tokens
errados seguidos sofrem atraso progressivo. Gerar um novo token ou revogar invalida o anterior.

## Deploy

### Vercel + Turso (recomendado, gratuito)

1. Importe o repositório na [Vercel](https://vercel.com) (framework Next.js; sem `vercel.json`).
2. Crie o banco pela integração do **Turso** no Marketplace da Vercel (*Storage*/*Integrations*) e
   conecte-o ao projeto. Ela já injeta `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (com rotação do
   token), que o app usa direto. Deixe-as só em *Production*: se ficarem também em *Preview*, os
   builds de outras branches aplicam migrações no banco de produção.
   Alternativa sem a integração: crie o banco na [CLI do Turso](https://turso.tech)
   (`turso db create concurso`, `turso db show concurso --url`, `turso db tokens create concurso`)
   e defina `DATABASE_URL` (`libsql://…`) e `DATABASE_AUTH_TOKEN`, que têm prioridade sobre as
   `TURSO_*`.
3. Em *Settings → Environment Variables* defina `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`,
   `ALLOWED_EMAILS` (opcional), `AUTH_SECRET` e `ENABLE_EXPERIMENTAL_COREPACK=1` (para a Vercel
   usar a versão do pnpm do `packageManager`). Não defina `APP_PASSWORD`. Em *Settings → General*,
   Node.js 24. Veja [Configurar o login com Google](#configurar-o-login-com-google).
4. Faça o deploy. O `pnpm build` aplica as migrações no Turso antes do `next build` (as variáveis
   do banco precisam estar disponíveis no build).

Nunca use `DATABASE_URL=file:` na Vercel (nem deixe o banco sem configurar, o que cai no SQLite
local): o sistema de arquivos é efêmero.

### Instalar no celular (PWA)

Com o app publicado em HTTPS, abra-o no navegador do celular:

- **Android (Chrome):** menu ⋮ → **Instalar app**. Ele abre em tela cheia, sem a barra de URL.
- **iPhone (Safari):** Compartilhar → **Adicionar à Tela de Início**.

Se você adicionou o app à tela inicial antes do suporte a PWA (quando não havia manifest), remova o
atalho antigo e instale de novo: o atalho antigo continua abrindo numa aba do navegador.

### Docker (VPS, Fly.io…)

O `Dockerfile` gera uma imagem `standalone` (Node 24, usuário sem privilégios) com o banco SQLite em
um volume em `/app/data`; as migrações rodam ao iniciar (`MIGRATE_ON_START=true`).

```bash
docker build -t concurso .
docker run -d --name concurso -p 3000:3000 \
  -v concurso-dados:/app/data \
  -e APP_PASSWORD='sua-senha' \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  concurso
```

Coloque um proxy com HTTPS na frente (Caddy, Traefik, Fly.io…). A imagem tem `HEALTHCHECK` em
`/api/health`. Sem `APP_PASSWORD` nem login Google o container recusa iniciar (salvo
`ALLOW_NO_AUTH=true`). Para o login com Google no container, troque `APP_PASSWORD` pelas variáveis
do Google (e `APP_URL`, se o proxy não repassar o host original). Para usar o Turso, passe
`DATABASE_URL`/`DATABASE_AUTH_TOKEN`.

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | aplica migrações pendentes e sobe o servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | build de produção (também aplica migrações) e execução |
| `pnpm lint` | lint + verificação de formatação (Biome, modo CI) |
| `pnpm format` | aplica formatação e correções seguras (Biome) |
| `pnpm typecheck` | checagem de tipos (`next typegen` + `tsc --noEmit`) |
| `pnpm test` / `pnpm test:watch` | testes unitários/integração (Vitest, em `TZ=UTC`) |
| `pnpm e2e` | build + testes e2e (Playwright/Chromium, bancos temporários) |
| `pnpm db:migrate` | aplica migrações pendentes no banco de `DATABASE_URL` (ou `TURSO_DATABASE_URL`) |
| `pnpm db:generate` | gera nova migração a partir de `src/server/db/schema.ts` |
| `pnpm db:seed` | insere concursos fictícios se o banco estiver vazio |
| `pnpm db:backup` | cópia do banco local em `backups/` (mantém as últimas N) |
| `pnpm db:studio` | abre o Drizzle Studio |
| `pnpm --silent mcp` | servidor MCP por stdio (para clientes como Claude Desktop/Code) |
| `pnpm icones` | gera favicon, ícones do PWA e `apple-icon.png` a partir de `assets/logo.svg` |

Antes do primeiro `pnpm e2e`, instale o navegador: `pnpm exec playwright install chromium`.

## Fluxo de trabalho (Gitflow)

- `master`: só versões liberadas (tags `vX.Y.Z`); `develop`: integração.
- `feature/<nome>` a partir de `develop`, com PR de volta para `develop`.
- `release/X.Y.Z` a partir de `develop` (versão no `package.json` + `CHANGELOG.md`), PR para
  `master`, tag e merge de volta em `develop`; `hotfix/<nome>` a partir de `master`.
- PRs exigem CI verde (Biome, tipos, testes, build, e2e e imagem Docker); PRs para `master` só
  de `release/*` ou `hotfix/*`. Commits no estilo Conventional Commits; mudanças registradas em
  `CHANGELOG.md` (seção `Unreleased`). A tag `vX.Y.Z` publica a GitHub Release com as notas do
  changelog.

Created in [T3 Code](https://t3.codes).
