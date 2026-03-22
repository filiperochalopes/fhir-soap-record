#!/bin/sh

set -eu

corepack enable
pnpm prisma generate
pnpm prisma migrate deploy

exec pnpm dev --host 0.0.0.0 --port 3000
