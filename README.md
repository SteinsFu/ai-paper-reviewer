# AI Paper Reviewer (Margin)

A generative-AI copilot for peer-reviewing academic papers. Upload a
manuscript and the tool reads it the way a careful reviewer would —
scoring writing quality, structure, methodology, logical consistency,
novelty and citation usage — then produces a structured, exportable
review report.

The system has two user interfaces backed by the same review pipeline
on **Amazon Bedrock** (Claude Haiku 4.5 / Sonnet 4.5):

- **Margin (React SPA)** — the primary interface, with reader, novelty,
  report and dashboard views. Recommended for regular use.
- **Streamlit prototype** — a lightweight single-page UI kept for quick
  demos and debugging. Also supports a *university-report* grading mode.

---

## Prerequisites

1. **Python 3.10+** (`python3 --version`)
2. **Node.js 22.12+** (or 20.19+) — check with `node -v`.
   Older Node has an npm bug that breaks the frontend install; use
   [nvm](https://github.com/nvm-sh/nvm) if you need to switch versions.
3. **An AWS Bedrock API key** with access to Claude Haiku 4.5 and
   Sonnet 4.5 in the `ap-southeast-2` (Sydney) region. See below.

## Getting a Bedrock API key

1. Sign in to the AWS Console and set the region (top-right) to
   **Asia Pacific (Sydney) — `ap-southeast-2`**.
2. Open **Amazon Bedrock** → **API keys** in the left sidebar.
3. Click **Generate API key** → choose **Short-term API key** (valid
   for up to 12 hours) → **Generate**.
4. Copy the value shown (starts with `ABSK...`). **Save it now — the
   key is not shown again.**
5. First-time users of Anthropic models may be prompted for a use-case
   description on their first invocation; fill it in (e.g. *"Academic
   research prototype for peer-review assistance"*) and submit.

Short-term keys expire after 12 h at most; regenerate whenever you see
`Bearer Token has expired` in the backend logs.

---

## Setup (one-time)

Clone the repository:

```bash
git clone git@github.com:SteinsFu/ai-paper-reviewer.git
cd ai-paper-reviewer
```

### Backend (Python)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create your `.env` and paste the Bedrock API key:

```bash
cp .env.example .env
```

Then open `.env` and set the value:

```
AWS_BEARER_TOKEN_BEDROCK=ABSK...
AWS_REGION=ap-southeast-2
```

### Frontend (React SPA)

```bash
cd margin/app
npm install
cd ../..
```

---

## Running the app

You need **two terminals** — one for the backend, one for the frontend.

**Terminal 1 — backend**

```bash
source .venv/bin/activate
uvicorn server:app --port 8000 --reload
```

Wait until you see `Uvicorn running on http://0.0.0.0:8000`.

**Terminal 2 — frontend**

```bash
cd margin/app
VITE_API_MODE=http VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Using the app

1. **Sign in** — a mock sign-in screen appears on first launch. Enter
   any email (`you@example.com`) and any 8+ character password. Nothing
   is sent anywhere; the account lives only in your browser.
2. In the sidebar click **New review** (or navigate to `/new`).
3. **Drop a manuscript** (PDF, `.txt`, or `.md`) on the upload zone,
   or click **Choose a manuscript** to pick one.
4. The Analyzing screen streams the 6-step pipeline
   (parsing → scoring → novelty → annotations → report → assembly).
   A typical 8-page paper takes 30–60 seconds.
5. You land on the paper's **Reader** view. Tabs at the top:
   - **Reader** — manuscript text with per-section annotations in the
     right sidebar.
   - **Novelty** — a novelty score, verdict, strengths and risks.
   - **Report** — structured summary / strengths / weaknesses / minor /
     recommendation, exportable as Markdown or PDF.

The **Dashboard** lists every paper you have reviewed so far.

---

## Redeploy on EC2

First-time setup is in [`docs/deploy-ec2.md`](docs/deploy-ec2.md). Confirm the
app locally first (`VITE_API_MODE=http`, upload a paper, restart uvicorn,
paper still on the Dashboard, `data/margin.db` exists). Then SSH in and
redeploy:

```bash
cd ~/ai-paper-reviewer
git pull
AWS_BEARER_TOKEN_BEDROCK='ABSK...' bash scripts/redeploy-ec2.sh
```

The script pulls, rebuilds the SPA into `/var/www/margin`, recreates the
`margin` container with `~/margin-data` mounted, and curls
`http://127.0.0.1:8000/docs` (want `200`). Omit `-v` in a manual
`docker run` and a new container starts empty. No RDS.

---

## Alternative: the Streamlit prototype

For a minimal single-page UI (no React setup needed):

```bash
source .venv/bin/activate
streamlit run app.py
```

Opens at http://localhost:8501. Same review pipeline; simpler UI.
Provides a mode switch at the top for **academic paper** vs
**university report** feedback.

---

## Troubleshooting

**`Bearer Token has expired`** — Your Bedrock short-term key ran out.
Generate a new one in the AWS Console (see above) and update `.env`.

**`npm run dev` fails with `Cannot find native binding`** — Your Node
version is too old for Vite 8. Upgrade to Node 22.12 or newer:

```bash
nvm install 22 && nvm use 22
```

then re-run `npm install` in `margin/app`.

**Bedrock returns `AccessDeniedException`** — The IAM user tied to
your key does not have Bedrock model access in `ap-southeast-2`.
Confirm access is enabled for Claude Haiku 4.5 and Sonnet 4.5.

**Analyzing screen shows an error** — Check the backend terminal
(the uvicorn output) for the actual traceback; the frontend surfaces
the exception message from the pipeline.

**Upload fails with 413 / file too large** — nginx's default body
limit is 1 MB. Redeploy (`scripts/redeploy-ec2.sh`) so
`client_max_body_size 50M` is applied, or add that line to the nginx
site config and reload.

**Nothing happens after `npm run dev` starts** — Make sure the backend
is running on port 8000; the frontend uses `VITE_API_BASE_URL` to
reach it.

---

## Project layout

- `server.py` — FastAPI backend serving the React UI
- `bundle_builder.py` — Bedrock review pipeline (parse, score, novelty,
  annotations, report) producing a `ReviewBundle`
- `reviewer.py`, `novelty_review/` — prompt logic used by both UIs
- `pdf_utils.py` — PDF / text extraction
- `app.py` — Streamlit prototype UI
- `margin/app/` — Matteo's React SPA (Vite + React 19 + TypeScript)
- `scripts/redeploy-ec2.sh` — pull, rebuild SPA + API, restart Docker on EC2
- `docs/deploy-ec2.md` — first-time EC2 install
- `tests/` — Python unit tests (`pytest -q`)
