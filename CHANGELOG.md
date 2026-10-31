# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

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
