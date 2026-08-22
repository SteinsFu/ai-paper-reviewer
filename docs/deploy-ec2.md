# Deploy Margin on a single EC2 instance

This is the path that worked for a class AWS account **without IAM
role-creation rights**. One Ubuntu VM runs:

- **Docker** — FastAPI (`server.py`) on `127.0.0.1:8000`
- **nginx** — serves the React SPA and reverse-proxies `/analyze`,
  `/library`, `/paper`

The public URL is `http://ELASTIC_IP`. Same origin, so you do **not**
set `MARGIN_ALLOWED_ORIGINS`. Bedrock auth is **`AWS_BEARER_TOKEN_BEDROCK`**
only (no `margin-bedrock-task` IAM role).

**Not used:** ECS Express Mode, App Runner, S3, CloudFront (optional
later). App Runner is closed to new customers.

Prefer a **long-term** Bedrock API key on the server. Short-term keys
die in ≤12 h and `/analyze` breaks until you rotate the env var.

---

## Architecture

```
browser  →  http://ELASTIC_IP  (nginx :80)
              ├── /           →  /var/www/margin  (Vite dist)
              ├── /analyze    →  Docker :8000     (SSE, 180s timeout)
              ├── /library    →  Docker :8000
              └── /paper      →  Docker :8000
```

Port **8000** must stay bound to localhost. Do not open it in the
security group.

---

## What you need

- AWS Console access that can **launch EC2**, create a **key pair**,
  **security group**, and **Elastic IP** (same VPC as the instance)
- Region **Asia Pacific (Sydney) `ap-southeast-2`**
- Bedrock model access for Claude Haiku 4.5 and Sonnet 4.5 in that region
- This repo **including** `Dockerfile` and `.dockerignore` on the branch
  you clone (do **not** commit `.env`)
- A Bedrock API key (`ABSK…`)

If **Launch instance** returns `AccessDenied`, you cannot finish this
guide until an admin grants EC2 permissions. ECS `iam:GetRole` is a
different problem and is not required here.

---

## Phase 1 — Key pair

1. Console region: **Sydney `ap-southeast-2`**.
2. **EC2** → **Network & Security** → **Key Pairs** → **Create key pair**.
3. Name `margin-ec2`. Type **RSA**. Format **`.pem`**. Create. The file
   downloads once.
4. On your Mac:

```bash
chmod 400 ~/Downloads/margin-ec2.pem
```

---

## Phase 2 — Security group (same VPC as the instance)

Class accounts often use a named VPC (e.g. `next-ai-vpc`), **not**
Default VPC. The security group and the instance **must** share that VPC.
A group in Default VPC does not apply to an instance in `next-ai-vpc`.

1. **EC2** → **Security Groups** → **Create security group**.
2. Name `margin-web`. **VPC:** pick the VPC you will launch into
   (Default, or `next-ai-vpc`, etc.).
3. Inbound rules:

| Type | Port | Source |
|---|---|---|
| SSH | 22 | **My IP** (your current public IP, not the EC2 address) |
| HTTP | 80 | `0.0.0.0/0` |
| HTTPS | 443 | `0.0.0.0/0` (optional now; needed later for a domain) |

Do **not** open `8000`. Create the group.

**My IP** is whatever [checkip.amazonaws.com](https://checkip.amazonaws.com)
shows. A new cafe/VPN/hotspot is a new IP; edit the SSH rule or SSH
times out.

---

## Phase 3 — Launch the instance

1. **EC2** → **Instances** → **Launch instance**.
2. Name `margin`.
3. AMI: **Ubuntu Server 24.04 LTS** (user is `ubuntu`).
4. Type: **t3.small** (2 GB). `t3.micro` can OOM with PDF + Docker.
5. Key pair: `margin-ec2`.
6. Network: **same VPC** as `margin-web`. Subnet: a **public** subnet
   (name often contains `public`). Security group: **Select existing**
   → `margin-web`.
7. If **Auto-assign public IP** is off, you will see Public IPv4 `–`
   after launch. Phase 4 fixes that.
8. Storage 16 GB is enough. **Launch**. Wait until **Running** and
   status checks pass.

---

## Phase 4 — Elastic IP

A dash (`–`) under **Public IPv4 address** means there is nothing to
copy. Allocate an Elastic IP and associate it.

1. **EC2** → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
2. Select it → **Actions** → **Associate Elastic IP address**.
3. Instance = your `margin` instance. **Associate**.
4. Instance details should now show a **Public IPv4** and that Elastic
   IP. Use this address everywhere below (`EIP`).

Stop/start without an Elastic IP can change the public address.

---

## Phase 5 — SSH

```bash
ssh -i ~/Downloads/margin-ec2.pem ubuntu@EIP
```

Amazon Linux AMIs use `ec2-user` instead of `ubuntu`.

| Symptom | Likely cause |
|---|---|
| Timeout | SSH rule not My IP, wrong security group VPC, instance still starting |
| `Permission denied (publickey)` | Wrong `.pem` or missing `chmod 400` |
| `AccessDenied` on Allocate/Associate | Ask admin for `ec2:AllocateAddress` + `ec2:AssociateAddress` |

---

## Phase 6 — Docker, git, nginx, Node 22

Ubuntu’s apt `nodejs` is **18**. Vite 8 needs **22.12+** (or 20.19+).
Install Node 22 from NodeSource **after** removing apt Node if you
already installed it.

```bash
sudo apt-get update
sudo apt-get install -y docker.io nginx git
sudo usermod -aG docker ubuntu
sudo apt-get remove -y nodejs
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Exit SSH and connect again** (docker group). Then:

```bash
docker --version
node -v    # must be v22.x (22.12+)
```

Still `v18` means NodeSource did not apply. Do not run `npm run build`
until `node -v` is 22.

---

## Phase 7 — Clone, build SPA, run API

`margin/app/dist/` is gitignored. You must build it on the instance.

```bash
cd ~
git clone https://github.com/SteinsFu/ai-paper-reviewer.git
cd ~/ai-paper-reviewer
```

Private repo: GitHub PAT as the password when `git clone` asks.
If `Dockerfile` is missing, push it from your laptop and `git pull`.

```bash
cd ~/ai-paper-reviewer/margin/app
npm install
VITE_API_MODE=http VITE_API_BASE_URL= npm run build
```

What that build line does:

- `VITE_API_MODE=http` — real FastAPI client, not mock data
- `VITE_API_BASE_URL=` — empty on purpose. Vite bakes this in at
  **build** time. Empty = browser calls `/analyze` on the same host
  (nginx). If you omit the var, it defaults to `http://localhost:8000`
  (the visitor’s laptop).
- Rebuilding is required if you change either var

If you installed Node 18 first, wipe and reinstall:

```bash
cd ~/ai-paper-reviewer/margin/app
rm -rf node_modules
npm install
VITE_API_MODE=http VITE_API_BASE_URL= npm run build
```

API image and container (repo root). Paste the Bedrock key; do not copy
`.env` into git or the image (`.dockerignore` excludes `.env`).

```bash
cd ~/ai-paper-reviewer
docker build -t margin .
docker run -d --name margin --restart unless-stopped -p 127.0.0.1:8000:8000 \
  -e AWS_REGION=ap-southeast-2 \
  -e AWS_BEARER_TOKEN_BEDROCK='PASTE_YOUR_ABSK_KEY_HERE' \
  margin
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/docs
```

`docker build -t margin .` builds a **local** image named `margin` from
the `Dockerfile` in the current directory. It does not push to ECR.

`200` from curl = API is up. Otherwise: `docker logs margin`.

---

## Phase 8 — nginx

```bash
sudo mkdir -p /var/www/margin
sudo cp -r ~/ai-paper-reviewer/margin/app/dist/* /var/www/margin/
sudo tee /etc/nginx/sites-available/margin >/dev/null <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/margin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /docs { proxy_pass http://127.0.0.1:8000; }
    location /openapi.json { proxy_pass http://127.0.0.1:8000; }

    location /analyze {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location /library { proxy_pass http://127.0.0.1:8000; }
    location /paper { proxy_pass http://127.0.0.1:8000; }
}
EOF
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/margin /etc/nginx/sites-enabled/margin
sudo nginx -t && sudo systemctl reload nginx
```

Browser: `http://EIP` (app), `http://EIP/docs` (Swagger).

---

## Phase 9 — Smoke test

1. Open `http://EIP`. Mock sign-in (any email, 8+ character password).
2. **New review**. Upload a **short** PDF.
3. Analyzing should stream and land on Reader.

| Failure | Check |
|---|---|
| Site loads, reviews are fake | SPA built without `VITE_API_MODE=http` |
| Calls `localhost:8000` | `VITE_API_BASE_URL` was unset; rebuild with empty `=` |
| Bedrock / expired token | `docker logs margin`; new long-term key; `docker rm -f margin` and `docker run` again |
| CORS errors | Should not happen on this setup; you are same-origin |

Reviews live in memory on **this** container. Redeploy or reboot
without `--restart unless-stopped` clears the library.

---

## Updating later

**Website**

```bash
cd ~/ai-paper-reviewer
git pull
cd margin/app
npm install
VITE_API_MODE=http VITE_API_BASE_URL= npm run build
sudo cp -r dist/* /var/www/margin/
sudo nginx -s reload
```

**API**

```bash
cd ~/ai-paper-reviewer
git pull
docker build -t margin .
docker rm -f margin
docker run -d --name margin --restart unless-stopped -p 127.0.0.1:8000:8000 \
  -e AWS_REGION=ap-southeast-2 \
  -e AWS_BEARER_TOKEN_BEDROCK='PASTE_YOUR_ABSK_KEY_HERE' \
  margin
```

---

## Optional — CloudFront URL

Puts `https://dxxxxxxxx.cloudfront.net` in front of **this** instance.
No SPA rebuild if `VITE_API_BASE_URL` was empty.

**Limit:** CloudFront origin timeout max is **60 s** (default 30). A
slow `/analyze` can 504. The Elastic IP URL has no that cap.

1. Instance → copy **Public IPv4 DNS**
   (`ec2-…ap-southeast-2.compute.amazonaws.com`). CloudFront origin
   must be that hostname, not the raw IP.
2. **CloudFront** → **Create distribution**.
3. Origin = that DNS name. Protocol **HTTP only**. Response timeout
   **60**.
4. Allowed methods include **POST** (`GET, HEAD, OPTIONS, PUT, POST,
   PATCH, DELETE`).
5. Cache policy **CachingDisabled**.
6. Viewer: redirect HTTP → HTTPS. Skip WAF. Default root object
   `index.html`.
7. Do **not** map 403/404 to `/index.html` (nginx already does SPA
   fallback; that rewrite would hide API 404s).
8. Wait until **Enabled**. Open `https://dxxxx.cloudfront.net`.

A real domain (`https://review.example.com`) on nginx + Let’s Encrypt
fits this SSE app better than CloudFront. Point DNS at the Elastic IP,
then:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain
```

---

## Stop billing

EC2 → instance → **Instance state** → **Stop** (keeps the disk) or
**Terminate** (deletes it). After terminate, **Release** the Elastic IP
or an unused address still bills.

---

## Files this deploy uses

- `Dockerfile` — Python 3.12 slim, uvicorn on 8000
- `.dockerignore` — excludes `.env`, `margin/`, tests
- `server.py` — FastAPI
- `margin/app/` — Vite SPA, built on the instance
