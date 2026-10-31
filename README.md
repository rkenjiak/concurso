<img src="assets/icon.svg" width="64" height="64" alt="">

# concurso

App pessoal para cadastrar e acompanhar concursos públicos — do "radar" até a posse.
Documentação: [requisitos](docs/REQUISITOS.md) · [arquitetura](docs/ARQUITETURA.md) · [changelog](CHANGELOG.md).

## Requisitos

- Node.js 24 LTS ou superior (veja `.nvmrc`)
- pnpm (versão em `packageManager` no `package.json`)

## Como rodar

```bash
pnpm install
cp .env.example .env.local   # opcional: os padrões funcionam localmente
pnpm dev                     # http://localhost:3000
```

O banco local fica em `data/concurso.db` (fora do Git). Para usar o Turso, defina
`DATABASE_URL=libsql://…` e `DATABASE_AUTH_TOKEN` no `.env.local`.

Uso diário em modo produção local:

```bash
pnpm build
pnpm start
```

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | aplica migrações pendentes e sobe o servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | build de produção (também aplica migrações) e execução |
| `pnpm lint` | lint + verificação de formatação (Biome, modo CI) |
| `pnpm format` | aplica formatação e correções seguras (Biome) |
| `pnpm typecheck` | checagem de tipos (`tsc --noEmit`) |
| `pnpm test` | testes unitários/integração (Vitest, em `TZ=UTC`) |
| `pnpm db:migrate` | aplica migrações pendentes no banco de `DATABASE_URL` |
| `pnpm db:generate` | gera nova migração a partir de `src/server/db/schema.ts` |
| `pnpm db:seed` | insere concursos fictícios se o banco estiver vazio |
| `pnpm db:studio` | abre o Drizzle Studio |

## Fluxo de trabalho

Gitflow: `feature/*` a partir de `develop` com PR de volta para `develop`; `release/*` e `hotfix/*`
são as únicas branches que entram em `master`. Commits no estilo Conventional Commits.

Created in [T3 Code](https://t3.codes).
