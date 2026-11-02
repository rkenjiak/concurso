# syntax=docker/dockerfile:1
# Imagem de produção (ARQUITETURA.md §9.2): build `standalone` do Next.js, usuário sem privilégios
# e banco SQLite em volume (/app/data). Uso:
#   docker build -t concurso .
#   docker run -d -p 3000:3000 -v concurso-dados:/app/data \
#     -e APP_PASSWORD=... -e AUTH_SECRET=... concurso

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.16.1

# ---- dependências ----
FROM node:${NODE_VERSION}-bookworm-slim AS deps
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM node:${NODE_VERSION}-bookworm-slim AS builder
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` direto: as migrações rodam ao iniciar o container (MIGRATE_ON_START), no volume.
RUN pnpm exec next build

# ---- execução ----
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/concurso.db \
    MIGRATE_ON_START=true

RUN groupadd --system --gid 1001 concurso \
 && useradd --system --uid 1001 --gid concurso --no-create-home concurso \
 && mkdir -p /app/data \
 && chown concurso:concurso /app/data

COPY --from=builder --chown=concurso:concurso /app/.next/standalone ./
COPY --from=builder --chown=concurso:concurso /app/.next/static ./.next/static
# O `standalone` não inclui `public/` (ícones do manifest do PWA, #66).
COPY --from=builder --chown=concurso:concurso /app/public ./public
COPY --from=builder --chown=concurso:concurso /app/drizzle ./drizzle

USER concurso
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
