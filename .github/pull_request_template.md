## O que muda

<!-- Resumo curto da mudança e do motivo. Referencie RF/RNF quando fizer sentido. -->

## Como testar

<!-- Passos para validar manualmente, se aplicável. -->

## Checklist

- [ ] Branch segue o Gitflow (`feature/*` → `develop`; `release/*`/`hotfix/*` → `master`)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passam localmente
- [ ] Testes adicionados/atualizados para regras de domínio alteradas
- [ ] Mudança de schema acompanha nova migração Drizzle
- [ ] `CHANGELOG.md` atualizado na seção `Unreleased`
- [ ] Nenhum dado pessoal, `.env` ou banco versionado
