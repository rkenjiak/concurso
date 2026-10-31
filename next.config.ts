import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não anuncia o framework nos headers de resposta.
  poweredByHeader: false,
  // Driver libSQL usa binários nativos: carregado pelo Node em vez de empacotado.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Saída enxuta para a imagem Docker (`NEXT_OUTPUT=standalone`, ver Dockerfile). Fora dela, o
  // build padrão (Vercel, `pnpm start`).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
