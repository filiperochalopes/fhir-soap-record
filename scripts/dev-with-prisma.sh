#!/bin/sh

set -eu

corepack enable
# The bind-mounted project can originate on macOS while this script runs on
# Linux. Reconcile optional native packages in the container-owned node_modules
# volume before starting Vite.
CI=true pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy

exec pnpm dev --host 0.0.0.0 --port 3000
