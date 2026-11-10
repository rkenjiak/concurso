import type { NextConfig } from "next";
import { cabecalhosSeguranca } from "./src/lib/cabecalhos-seguranca";
import { commitGit, valoresBuild } from "./src/lib/versao-build";

const nextConfig: NextConfig = {
  // Não anuncia o framework nos headers de resposta.
  poweredByHeader: false,
  // Versão, commit, ambiente e data do build (#118), fixados no bundle (servidor e cliente) como
  // `process.env.APP_*` e lidos por `src/lib/versao.ts`. Commit: `VERCEL_GIT_COMMIT_SHA` → build
  // arg `GIT_COMMIT_SHA` → git → `dev`.
  env: valoresBuild(process.env, commitGit, new Date()),
  // Driver libSQL usa binários nativos: carregado pelo Node em vez de empacotado.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Saída enxuta para a imagem Docker (`NEXT_OUTPUT=standalone`, ver Dockerfile). Fora dela, o
  // build padrão (Vercel, `pnpm start`).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // `forbidden()` (403) no painel admin (#50).
  experimental: { authInterrupts: true },
  // CSP, anti-clickjacking, nosniff, Referrer/Permissions-Policy em todas as rotas (#95).
  async headers() {
    const dev = process.env.NODE_ENV === "development";
    return [{ source: "/:path*", headers: cabecalhosSeguranca(dev) }];
  },
};

export default nextConfig;
