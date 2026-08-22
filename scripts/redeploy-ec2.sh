#!/usr/bin/env bash
# Redeploy Margin on the EC2 box this script is copied to.
# Run from anywhere after git pull of this repo:
#
#   cd ~/ai-paper-reviewer
#   bash scripts/redeploy-ec2.sh
#
# Bedrock key: export AWS_BEARER_TOKEN_BEDROCK=ABSK...  or reuse the
# key already on the running `margin` container. Region defaults to
# ap-southeast-2 (override with AWS_REGION).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${MARGIN_DATA_DIR:-$HOME/margin-data}"
WEB_ROOT="${MARGIN_WEB_ROOT:-/var/www/margin}"
REGION="${AWS_REGION:-ap-southeast-2}"
IMAGE="margin"
CONTAINER="margin"

key_from_container() {
  docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$CONTAINER" 2>/dev/null \
    | sed -n 's/^AWS_BEARER_TOKEN_BEDROCK=//p' \
    | head -n 1
}

KEY="${AWS_BEARER_TOKEN_BEDROCK:-}"
if [[ -z "$KEY" ]]; then
  KEY="$(key_from_container || true)"
fi
if [[ -z "$KEY" ]]; then
  echo "Set AWS_BEARER_TOKEN_BEDROCK (or start from a container that already has it)." >&2
  exit 1
fi

echo "== git pull"
cd "$REPO_ROOT"
git pull --ff-only

echo "== SPA build"
cd "$REPO_ROOT/margin/app"
npm install
VITE_API_MODE=http VITE_API_BASE_URL= npm run build
sudo mkdir -p "$WEB_ROOT"
sudo cp -r dist/* "$WEB_ROOT/"
sudo nginx -s reload

echo "== API image"
cd "$REPO_ROOT"
mkdir -p "$DATA_DIR"
docker build -t "$IMAGE" .
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --restart unless-stopped -p 127.0.0.1:8000:8000 \
  -v "$DATA_DIR:/data" \
  -e MARGIN_DB_PATH=/data/margin.db \
  -e "AWS_REGION=$REGION" \
  -e "AWS_BEARER_TOKEN_BEDROCK=$KEY" \
  "$IMAGE"

echo "== health"
code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/docs || true)"
if [[ "$code" != "200" ]]; then
  echo "API docs returned $code. docker logs $CONTAINER" >&2
  docker logs "$CONTAINER" >&2 || true
  exit 1
fi
echo "ok  SPA+$WEB_ROOT  API=$code  db=$DATA_DIR/margin.db"
