#!/bin/sh

set -eu

./node_modules/.bin/prisma migrate deploy

exec ./node_modules/.bin/react-router-serve ./build/server/index.js
