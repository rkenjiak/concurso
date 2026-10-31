import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não anuncia o framework nos headers de resposta.
  poweredByHeader: false,
  // Driver libSQL usa binários nativos: carregado pelo Node em vez de empacotado.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
