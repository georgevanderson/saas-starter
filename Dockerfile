# syntax=docker/dockerfile:1.7
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Stubs so Next can build (modules init eagerly).
# Real values come from Cloud Run env at runtime.
ENV POSTGRES_URL="postgres://stub:stub@127.0.0.1:5432/stub"
ENV AUTH_SECRET="build-only-stub"
ENV STRIPE_WEBHOOK_SECRET="whsec_buildstub"
ENV BASE_URL="https://gcp.test.agents.study"
ENV RESEND_API_KEY="re_buildstub"
ENV RESEND_FROM_EMAIL="noreply@gcp.test.agents.study"
ENV BLOB_READ_WRITE_TOKEN="vercel_blob_rw_buildstub_123"
ENV CRON_SECRET="buildstub-cron"
ENV STRIPE_SECRET_KEY="sk_test_buildstub"
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
CMD ["node_modules/.bin/next", "start", "-p", "8080", "-H", "0.0.0.0"]
