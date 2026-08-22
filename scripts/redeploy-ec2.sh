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
echo "Pulling latest code..."
cd ~/ai-paper-reviewer
git pull

# Build the frontend image
echo "Building frontend image..."
cd ~/ai-paper-reviewer/margin/app
npm install
VITE_API_MODE=http VITE_API_BASE_URL= npm run build
sudo cp -r dist/* /var/www/margin/
sudo nginx -s reload

# Build the backend image
echo "Building backend image..."
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

# Check the status
echo "Checking status..."
code="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/docs || true)"
if [ "$code" = "200" ]; then
  echo "status 200 Success!"
else
  echo "status $code failed. docker logs margin" >&2
  exit 1
fi
