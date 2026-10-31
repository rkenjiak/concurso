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

Uso diário em modo produção local:

```bash
pnpm build
pnpm start
```

## Scripts

| Comando                     | O que faz                                         |
| --------------------------- | ------------------------------------------------- |
| `pnpm dev`                  | servidor de desenvolvimento                       |
| `pnpm build` / `pnpm start` | build de produção e execução                      |
| `pnpm lint`                 | lint + verificação de formatação (Biome, modo CI) |
| `pnpm format`               | aplica formatação e correções seguras (Biome)     |
| `pnpm typecheck`            | checagem de tipos (`tsc --noEmit`)                |
| `pnpm test`                 | testes unitários/integração (Vitest, em `TZ=UTC`) |

## Fluxo de trabalho

Gitflow: `feature/*` a partir de `develop` com PR de volta para `develop`; `release/*` e `hotfix/*`
são as únicas branches que entram em `master`. Commits no estilo Conventional Commits.

Created in [T3 Code](https://t3.codes).
