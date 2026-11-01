<img src="assets/icon.svg" width="64" height="64" alt="">

# concurso

App pessoal para cadastrar e acompanhar concursos públicos — do "radar" até a posse: dados do
edital, status com histórico, datas importantes (inscrição, boleto, provas, recursos), dashboard de
próximos prazos, busca e filtros, resultados por fase, validade do concurso e backup/restauração.
Com o [servidor MCP](#cadastro-pelo-edital-com-uma-llm-mcp), uma LLM lê o edital e faz o cadastro.

Feito para **um usuário**: roda localmente com um comando (SQLite em arquivo) e, se quiser, pode ser
hospedado de graça (Vercel + Turso) ou em um container Docker, com login por senha.

Documentação: [requisitos](docs/REQUISITOS.md) · [arquitetura](docs/ARQUITETURA.md) ·
[changelog](CHANGELOG.md).

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

Em produção o app **recusa iniciar sem `APP_PASSWORD`**, a menos que `ALLOW_NO_AUTH=true` — veja
[Autenticação](#autenticação).

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e ajuste. Nada é obrigatório para rodar localmente.

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | `file:./data/concurso.db` | Banco libSQL: arquivo SQLite local ou `libsql://<banco>.turso.io` |
| `DATABASE_AUTH_TOKEN` | — | Token do Turso (só com `libsql://`) |
| `APP_PASSWORD` | — | Liga o login por senha única; sem ela, a autenticação fica desligada |
| `AUTH_SECRET` | — | Segredo (≥ 32 bytes) que assina a sessão; obrigatório com `APP_PASSWORD` |
| `ALLOW_NO_AUTH` | `false` | `true` permite rodar em produção sem senha (uso local, sem exposição) |
| `MIGRATE_ON_START` | `false` | `true` aplica as migrações ao iniciar o servidor (já ligado na imagem Docker) |
| `BACKUP_KEEP` | `10` | Quantos backups o `pnpm db:backup` mantém |
| `MCP_TOKEN` | — | Liga o endpoint MCP `/api/mcp` (≥ 32 caracteres); sem ele o endpoint fica desligado |

## Autenticação

- **Sem `APP_PASSWORD`**: sem login (uso local).
- **Com `APP_PASSWORD` e `AUTH_SECRET`**: todas as páginas e APIs exigem login (exceto `/login` e
  `/api/health`). A sessão fica em um cookie JWT assinado (`httpOnly`, `SameSite=Lax`, `Secure` em
  produção) válido por 30 dias; "Sair" fica em **Configurações**. Após 5 senhas erradas, novas
  tentativas do mesmo cliente esperam cada vez mais.
- Gere o segredo com `openssl rand -base64 32` (ou
  `node -e "console.log(crypto.randomBytes(32).toString('base64'))"`). Trocar o `AUTH_SECRET`
  encerra todas as sessões.
- Em produção (`NODE_ENV=production`) o servidor não inicia sem `APP_PASSWORD`, salvo
  `ALLOW_NO_AUTH=true`, nem com `AUTH_SECRET` curto.
- Hospedado, use sempre HTTPS (o cookie de sessão é `Secure` em produção; `localhost` é exceção
  nos navegadores).

## Backup e restauração

**Export/import JSON (qualquer banco).** Em **Configurações**: "Baixar backup (JSON)" gera um
arquivo versionado com todos os dados (concursos, tags, links, eventos, histórico, resultados);
"Baixar concursos (CSV)" gera uma planilha (separador `;`). "Importar…" restaura um backup JSON
**substituindo todos os dados** (com confirmação; tudo ou nada). Também serve para migrar entre
local ↔ hospedado.

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

**Local (stdio)** — usa o mesmo banco do app (`DATABASE_URL` do `.env.local`). O `--silent` é
necessário: o protocolo usa o stdout.

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

**Hospedado (HTTP)** — defina `MCP_TOKEN` (gere com `openssl rand -base64 32`) e conecte o cliente a
`https://<seu-app>/api/mcp` com o header `Authorization: Bearer <MCP_TOKEN>`:

```bash
claude mcp add --transport http concurso https://<seu-app>/api/mcp   --header "Authorization: Bearer $MCP_TOKEN"
```

O token é independente da senha do app; tokens errados seguidos sofrem atraso progressivo. Trocar o
`MCP_TOKEN` revoga o acesso dos clientes antigos.

## Deploy

### Vercel + Turso (recomendado, gratuito)

1. Crie um banco no [Turso](https://turso.tech) e gere um token:
   `turso db create concurso`, `turso db show concurso --url`, `turso db tokens create concurso`.
2. Importe o repositório na [Vercel](https://vercel.com) (framework Next.js; sem `vercel.json`).
3. Em *Settings → Environment Variables* defina `DATABASE_URL` (`libsql://…`),
   `DATABASE_AUTH_TOKEN`, `APP_PASSWORD`, `AUTH_SECRET` e `ENABLE_EXPERIMENTAL_COREPACK=1` (para a
   Vercel usar a versão do pnpm do `packageManager`). Em *Settings → General*, Node.js 24.
4. Faça o deploy. O `pnpm build` aplica as migrações no Turso antes do `next build` (as variáveis
   do banco precisam estar disponíveis no build).

Nunca use `DATABASE_URL=file:` na Vercel: o sistema de arquivos é efêmero.

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
`/api/health`. Para usar o Turso no container, passe `DATABASE_URL`/`DATABASE_AUTH_TOKEN`.

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | aplica migrações pendentes e sobe o servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | build de produção (também aplica migrações) e execução |
| `pnpm lint` | lint + verificação de formatação (Biome, modo CI) |
| `pnpm format` | aplica formatação e correções seguras (Biome) |
| `pnpm typecheck` | checagem de tipos (`tsc --noEmit`) |
| `pnpm test` | testes unitários/integração (Vitest, em `TZ=UTC`) |
| `pnpm e2e` | build + testes e2e (Playwright/Chromium, bancos temporários) |
| `pnpm db:migrate` | aplica migrações pendentes no banco de `DATABASE_URL` |
| `pnpm db:generate` | gera nova migração a partir de `src/server/db/schema.ts` |
| `pnpm db:seed` | insere concursos fictícios se o banco estiver vazio |
| `pnpm db:backup` | cópia do banco local em `backups/` (mantém as últimas N) |
| `pnpm db:studio` | abre o Drizzle Studio |
| `pnpm --silent mcp` | servidor MCP por stdio (para clientes como Claude Desktop/Code) |

Antes do primeiro `pnpm e2e`, instale o navegador: `pnpm exec playwright install chromium`.

## Fluxo de trabalho (Gitflow)

- `master`: só versões liberadas (tags `vX.Y.Z`); `develop`: integração.
- `feature/<nome>` a partir de `develop`, com PR de volta para `develop`.
- `release/X.Y.Z` a partir de `develop` (versão no `package.json` + `CHANGELOG.md`), PR para
  `master`, tag e merge de volta em `develop`; `hotfix/<nome>` a partir de `master`.
- PRs exigem CI verde (Biome, tipos, testes, build, e2e e imagem Docker). Commits no estilo
  Conventional Commits; mudanças registradas em `CHANGELOG.md` (seção `Unreleased`).

Created in [T3 Code](https://t3.codes).
