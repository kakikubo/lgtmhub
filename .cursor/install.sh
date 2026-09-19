#!/usr/bin/env bash
# Cloud Agent install: refresh Node/pnpm deps without running prepare (lefthook).
# Cursor manages core.hooksPath; lefthook install in prepare conflicts and fails.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Prefer nvm Node 24 over any older shim on PATH (engine-strict requires 24.x).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use default >/dev/null 2>&1 || nvm use 24 >/dev/null 2>&1 || true
  _node_bin="$NVM_DIR/versions/node/$(nvm version default 2>/dev/null)/bin"
  if [ -d "$_node_bin" ]; then
    export PATH="$_node_bin:$PATH"
  fi
fi

corepack enable >/dev/null 2>&1 || true

echo "cloud-install: node=$(node -v) pnpm=$(pnpm -v)"
pnpm install --frozen-lockfile --ignore-scripts
pnpm rebuild
echo "cloud-install: done"
