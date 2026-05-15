#!/usr/bin/env bash
set -Eeuo pipefail

PM2_PROCESS="${PM2_PROCESS:-backend}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  printf '\n==> %s\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command git
require_command npm
require_command pm2

cd "${REPO_ROOT}"

log "Pulling latest code"
git pull --ff-only

log "Installing dependencies"
npm ci

log "Building backend"
npm run build -w @gift-wishes/api

log "Applying Prisma migrations"
npm exec -- prisma migrate deploy --schema prisma/schema.prisma

log "Restarting PM2 process: ${PM2_PROCESS}"
pm2 restart "${PM2_PROCESS}" --update-env

log "Current PM2 status"
pm2 status "${PM2_PROCESS}"
