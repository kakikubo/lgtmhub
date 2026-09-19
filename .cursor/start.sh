#!/usr/bin/env bash
# Cloud Agent start: Docker + nested-bridge fix + Supabase Local + .env.local.
# Idempotent: safe to re-run when dockerd / supabase are already up.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- Node 24 (nvm) on PATH ---
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

# --- 1. Start Docker daemon if not already running ---
if ! docker info >/dev/null 2>&1; then
  sudo mkdir -p /etc/docker
  echo '{"storage-driver":"fuse-overlayfs","iptables":true}' | sudo tee /etc/docker/daemon.json >/dev/null
  # Only launch a new daemon when none is running; clear stale pid/socket left in a snapshot.
  if ! pgrep -x dockerd >/dev/null 2>&1; then
    sudo rm -f /var/run/docker.pid /var/run/docker.sock
    sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
  fi
  for _ in $(seq 1 90); do
    if sudo docker info >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

# --- 2. Allow non-root docker access + fix nested bridge networking ---
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
# Container-to-container traffic on the docker bridge is dropped in this nested VM
# because two firewall backends are active: the legacy iptables FORWARD chain has a
# DROP policy with no docker rules, and bridged frames also traverse FORWARD. Open
# FORWARD on both backends AND bypass bridge netfilter so both paths succeed.
sudo iptables -P FORWARD ACCEPT 2>/dev/null || true
if command -v iptables-legacy >/dev/null 2>&1; then
  sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null || true
fi
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0 >/dev/null 2>&1 || true
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0 >/dev/null 2>&1 || true

# --- 3. Start Supabase Local (idempotent; config.toml may reference OAuth envs) ---
export GITHUB_OAUTH_CLIENT_ID="${GITHUB_OAUTH_CLIENT_ID:-}"
export GITHUB_OAUTH_CLIENT_SECRET="${GITHUB_OAUTH_CLIENT_SECRET:-}"
pnpm exec supabase start >/tmp/supabase-start.log 2>&1 || true

# --- 4. Write .env.local from the live Supabase status ---
# supabase start can return before the db container reports ready, so retry the
# status query until it yields a valid API_URL.
read_key() {
  printf '%s' "$1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s)['$2'];if(v)process.stdout.write(v)}catch(e){}})"
}

for _ in $(seq 1 30); do
  status="$(pnpm exec supabase status -o json 2>/dev/null || true)"
  api="$(read_key "$status" API_URL)"
  anon="$(read_key "$status" ANON_KEY)"
  srk="$(read_key "$status" SERVICE_ROLE_KEY)"
  if [ -n "$api" ] && [ -n "$anon" ] && [ -n "$srk" ]; then
    cat >"$ROOT/.env.local" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$api
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$srk
BLOB_READ_WRITE_TOKEN=
EOF
    echo "cloud-start: wrote $ROOT/.env.local"
    echo "cloud-start: done"
    exit 0
  fi
  sleep 2
done

echo "cloud-start: warning: supabase status did not yield keys; see /tmp/supabase-start.log" >&2
echo "cloud-start: done"
exit 0
