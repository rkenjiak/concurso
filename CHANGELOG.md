# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- Projeto Next.js (App Router) + React + TypeScript strict, Tailwind CSS, Biome e Vitest (testes em `TZ=UTC`).
- Scripts pnpm `dev`, `build`, `start`, `lint`, `format`, `typecheck` e `test`; `.env.example` e `.nvmrc`.
- CI no GitHub Actions (Biome, tipos, testes com cobertura, build e política de branches para `master`),
  release automática a partir de tags `vX.Y.Z`, template de PR e Dependabot apontando para `develop`.
- Banco SQLite/libSQL com Drizzle ORM: schema completo (concurso, link, evento, status_historico,
  resultado_fase, tag, concurso_tag, anexo), migração inicial em `drizzle/`, client via `DATABASE_URL`/
  `DATABASE_AUTH_TOKEN`, migrações automáticas antes de `dev`/`build` e seed opcional com dados fictícios.
- Normalização de texto para busca (`lib/normalize.ts`).
