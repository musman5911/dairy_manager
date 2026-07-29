#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${MONGO_URI:-}" ]]; then
  echo "Error: MONGO_URI environment variable is missing." >&2
  echo "Please add it in Replit Secrets (MONGO_URI=<MongoDB Atlas connection string>)." >&2
  exit 1
fi

if [[ ! -d "client/node_modules" ]]; then
  npm --prefix client install --include=dev
fi

if [[ ! -d "backend/node_modules" ]]; then
  npm --prefix backend install
fi

npm --prefix client run build

exec env NODE_ENV=production npm --prefix backend start
