import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não anuncia o framework nos headers de resposta.
  poweredByHeader: false,
};

export default nextConfig;
