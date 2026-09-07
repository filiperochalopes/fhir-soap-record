ARG PNPM_VERSION=10.17.1

FROM node:22-alpine AS deps
ARG PNPM_VERSION
WORKDIR /app

# Ghostscript compresses scanned PDF attachments before they reach S3.
RUN apk add --no-cache ghostscript

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm prisma generate

FROM deps AS build
WORKDIR /app

COPY . .
RUN pnpm prisma generate
RUN pnpm build

# Disposable cutover image. It contains the V1 reader and V2 converter with
# their development-only CLI dependencies, but is never used as the application
# runtime image.
FROM deps AS migration
WORKDIR /app

COPY . .
RUN pnpm prisma generate

CMD ["sh"]

FROM node:22-alpine AS runner
ARG PNPM_VERSION
WORKDIR /app

# Ghostscript compresses scanned PDF attachments before they reach S3.
RUN apk add --no-cache ghostscript

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate && \
    pnpm install --prod --frozen-lockfile

COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts

RUN chmod +x ./scripts/start-app.sh

EXPOSE 3000

CMD ["./scripts/start-app.sh"]
