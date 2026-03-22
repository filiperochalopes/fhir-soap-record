FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable
RUN pnpm install

COPY prisma ./prisma
RUN pnpm prisma generate

FROM deps AS build
WORKDIR /app

COPY . .
RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts/start-app.sh ./scripts/start-app.sh

RUN chmod +x ./scripts/start-app.sh

EXPOSE 3000

CMD ["./scripts/start-app.sh"]
