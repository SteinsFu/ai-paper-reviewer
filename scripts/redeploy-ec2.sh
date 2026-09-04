#!/usr/bin/env bash
# Redeploy Margin on an existing EC2 box (nginx + Docker already set up).
# First-time install: docs/deploy-ec2.md
#
#   AWS_BEARER_TOKEN_BEDROCK='ABSK...' bash scripts/redeploy-ec2.sh
set -euo pipefail

if [ -z "${AWS_BEARER_TOKEN_BEDROCK:-}" ]; then
  echo "Set AWS_BEARER_TOKEN_BEDROCK first:" >&2
  echo "  AWS_BEARER_TOKEN_BEDROCK='ABSK...' bash scripts/redeploy-ec2.sh" >&2
  exit 1
fi

# Pull the latest code
echo "================================================"
echo "Pulling latest code..."
echo "================================================"
cd ~/ai-paper-reviewer
git pull

# Build the frontend image
echo ""
echo "================================================"
echo "Building frontend and copying to /var/www/margin..."
echo "================================================"
cd ~/ai-paper-reviewer/margin/app
npm install
VITE_API_MODE=http VITE_API_BASE_URL= npm run build
sudo cp -r dist/* /var/www/margin/
# Raise nginx body size (default 1m rejects typical PDFs). Keep in sync
# with server.py MAX_UPLOAD_BYTES.
sudo tee /etc/nginx/conf.d/margin-upload.conf >/dev/null <<'EOF'
client_max_body_size 50M;
EOF
sudo nginx -t && sudo nginx -s reload

# Build the backend image
echo ""
echo "================================================"
echo "Building backend image..."
echo "================================================"
cd ~/ai-paper-reviewer
mkdir -p ~/margin-data
docker build -t margin .
docker rm -f margin
docker run -d --name margin --restart unless-stopped -p 127.0.0.1:8000:8000 \
  -v ~/margin-data:/data \
  -e MARGIN_DB_PATH=/data/margin.db \
  -e AWS_REGION=ap-southeast-2 \
  -e AWS_BEARER_TOKEN_BEDROCK="$AWS_BEARER_TOKEN_BEDROCK" \
  margin
echo ""
echo ">>> Backend image built! Please run \`docker image prune -f\` to remove unused images."

# Check the status (uvicorn needs a few seconds after docker run)
echo ""
echo "================================================"
echo "Checking status..."
echo "================================================"
code=""
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/docs || true)"
  if [ "$code" = "200" ]; then
    echo "status 200 Success!"
    exit 0
  fi
  sleep 2
done
echo "status $code failed. docker logs margin" >&2
exit 1
