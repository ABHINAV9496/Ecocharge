# EcoCharge — Continuous Deployment (CD)

Backend on AWS EC2 · Frontend on Vercel · Images via GitHub Container Registry

---

## Table of Contents

1. [Production Architecture](#1-production-architecture)
2. [How Deployment Works](#2-how-deployment-works)
3. [Prerequisites](#3-prerequisites)
4. [Vercel Setup — Frontend Deployment](#4-vercel-setup--frontend-deployment)
5. [GitHub Personal Access Token — for ghcr.io](#5-github-personal-access-token--for-ghcr-io)
6. [AWS EC2 Setup — Backend Server](#6-aws-ec2-setup--backend-server)
7. [GitHub Secrets Configuration](#7-github-secrets-configuration)
8. [Initial Deployment](#8-initial-deployment)
9. [Updating the Application](#9-updating-the-application)
10. [Rollback Procedure](#10-rollback-procedure)
11. [Troubleshooting](#11-troubleshooting)
12. [Useful Commands](#12-useful-commands)

---

## 1. Production Architecture

```
                           🌐 Internet

        ┌────────────────────────────────────┐
        │                                    │
        ▼                                    ▼
┌──────────────────┐          ┌──────────────────────────────┐
│   Vercel (Free)   │          │      AWS EC2 (t2.micro)      │
│                  │          │                              │
│   React App      │  HTTPS   │  Nginx (port 80)             │
│   (auto-deployed │─────────►│    │                        │
│    via GitHub)   │  /api/*  │  ┌┴──────┐  ┌───────────┐   │
│                  │  /ws/*   │  │Django │  │  FastAPI  │   │
│ VITE_API_URL =   │  /ai/*   │  │:8000  │  │  :8001    │   │
│ https://ec2-ip/  │          │  └───┬───┘  └─────┬─────┘   │
└──────────────────┘          │      │            │         │
                              │  ┌───┴────┐  ┌───┴─────┐   │
                              │  │PostGIS │  │  Redis   │   │
                              │  │:5432   │  │  :6379   │   │
                              │  └────────┘  └─────────┘   │
                              │        │                    │
                              │  ┌─────┴─────────────┐      │
                              │  │ Celery Worker/Beat  │      │
                              │  └───────────────────┘      │
                              └──────────────────────────────┘
```

**What each part does:**

| Component | Where | Job |
|-----------|-------|-----|
| **React Frontend** | Vercel (auto-deployed) | Serves the UI, makes API calls to EC2 |
| **Nginx** | EC2 container (port 80) | Reverse proxy — routes requests to the right backend |
| **Django** | EC2 container (internal) | REST API + WebSockets + Admin |
| **FastAPI** | EC2 container (internal) | AI chat assistant |
| **PostgreSQL** | EC2 container (internal) | Database with PostGIS + pgvector |
| **Redis** | EC2 container (internal) | Cache + Celery message broker |
| **Celery** | EC2 containers (internal) | Background tasks + scheduled tasks |

**Key points:**
- Only Nginx port 80 is exposed publicly — all other services are internal
- Frontend and backend are completely separate — independent deployments
- Frontend pushes happen automatically via Vercel GitHub integration
- Backend pushes happen via GitHub Actions → ghcr.io → EC2

---

## 2. How Deployment Works

Two separate deployment pipelines — one for frontend, one for backend.

### Frontend deployment (Vercel)

```
You push to main
       │
       ▼
GitHub detects change
       │
       ▼
Vercel GitHub Integration
  - Reads frontend/ directory
  - Runs npm run build
  - Deploys to *.vercel.app
  - Full deploy in ~1 min
```

### Backend deployment (GitHub Actions + ghcr.io + EC2)

```
You push to main
       │
       ▼
┌─────────────────────────────────┐
│   GitHub Actions (free tier)    │
│                                 │
│  1. Checkout code               │
│  2. Login to ghcr.io            │
│     (using your GitHub PAT)     │
│  3. docker compose build        │
│  4. Tag images: :latest + :SHA  │
│  5. Push to ghcr.io             │
└────────────┬────────────────────┘
             │ SSH
             ▼
┌─────────────────────────────────┐
│   AWS EC2 (t2.micro)            │
│                                 │
│  6. Login to ghcr.io            │
│  7. Write .env file             │
│  8. docker compose pull         │
│  9. docker compose up -d        │
│ 10. python manage.py migrate    │
│ 11. collectstatic               │
│ 12. docker image prune          │
└─────────────────────────────────┘
             │
             ▼
      Backend updated!
```

---

## 3. Prerequisites

| Item | Why | Cost |
|------|-----|------|
| **GitHub account** | Host code + run Actions + store container images | Free |
| **Vercel account** | Deploy the React frontend | Free |
| **AWS account** | Run backend on EC2 | Free tier eligible |

**What you DON'T need:**
- Docker Hub account
- Separate container registry
- Domain name (optional for later)
- Credit card (for AWS free tier)

---

## 4. Vercel Setup — Frontend Deployment

### Step 4.1 — Create a Vercel account
1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** → **Continue with GitHub**
3. Authorize Vercel to access your GitHub account

### Step 4.2 — Import your repository
1. Click **Add New** → **Project**
2. Find and select your `ecocharge` repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` (auto-detected) |
| **Output Directory** | `dist` (auto-detected) |
| **Node Version** | 20.x |

### Step 4.3 — Add environment variables
Click **Environment Variables** and add:

| Name | Value (will change after EC2 is ready) |
|------|----------------------------------------|
| `VITE_API_URL` | `https://YOUR_EC2_PUBLIC_IP/api` |
| `VITE_WS_URL` | `wss://YOUR_EC2_PUBLIC_IP/ws/stations/` |
| `VITE_WS_EVENTS_URL` | `wss://YOUR_EC2_PUBLIC_IP/ws/events/` |
| `VITE_GOOGLE_CLIENT_ID` | `511530245351-1nf6rp7lup50n4uni96qkeqpql15antu.apps.googleusercontent.com` |
| `VITE_OCM_API_KEY` | `36724cbe-784d-4f27-98d9-4ea77febf7d1` |

> **After EC2 is ready**, replace `YOUR_EC2_PUBLIC_IP` with the actual IP address. You can update these in Vercel dashboard → Project → Settings → Environment Variables → redeploy.

### Step 4.4 — Deploy
Click **Deploy**. Vercel will:
- Detect the `frontend/` directory
- Run `npm run build`
- Deploy to a URL like `ecocharge-xxx.vercel.app`

**From now on**, every push to `main` automatically triggers a new Vercel deployment.

> Your Vercel deployment URL looks like: `https://ecocharge-abc123.vercel.app`

---

## 5. GitHub Personal Access Token — for ghcr.io

GitHub Container Registry (ghcr.io) stores your Docker images. It's free and uses your GitHub account — no separate signup needed.

### Step 5.1 — Create a PAT (classic)

1. Go to GitHub → **Settings** (your profile picture, top right) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a name: `ecocharge-ghcr`
4. Set expiration: **No expiration** (or 90 days if you prefer rotating)
5. Select these scopes:

```
☑ write:packages
☑ read:packages
☑ delete:packages
☑ repo          (needed to read the repo)
```

6. Click **Generate token**
7. **Copy the token now** — it looks like `ghp_xxxxxxxxxxxxxxxxxxxx`

> Save this token somewhere safe (like a password manager). You'll add it to GitHub Secrets in step 7.

### Why this is needed

When GitHub Actions builds your Docker images, it needs to push them to ghcr.io. When EC2 pulls them, it also needs to authenticate. The PAT acts as the password for both operations.

---

## 6. AWS EC2 Setup — Backend Server

### Step 6.1 — Launch an EC2 instance

1. Log in to [AWS Console](https://console.aws.amazon.com)
2. Search for **EC2** and click **Launch Instance**
3. Configure:

| Setting | Value | Why |
|---------|-------|-----|
| Name | `ecocharge-backend` | Whatever you like |
| Application and OS Images | **Ubuntu 24.04 LTS** (free tier eligible) | Most Docker docs use Ubuntu |
| Architecture | **64-bit (x86)** | t2.micro is x86 |
| Instance type | **t2.micro** or **t3.micro** | Free tier eligible |
| Key pair | **Create new** → name it `ecocharge-key` → download `.pem` | You need this to SSH in |
| Network settings | **Create security group** | Configure ports below |
| Configure storage | **20 GB gp3** | Free tier gives 30 GB |

### Step 6.2 — Security Group (firewall rules)

Add these inbound rules:

| Type | Protocol | Port | Source | Purpose |
|------|----------|------|--------|---------|
| SSH | TCP | 22 | `0.0.0.0/0` | Connect from your computer |
| HTTP | TCP | 80 | `0.0.0.0/0` | Serve your API |

> **Security tip:** For SSH, restrict `Source` to your IP only (Google "what is my IP"). Change it later if your IP changes.

### Step 6.3 — Connect to your EC2 instance

Open a terminal (PowerShell on Windows, Terminal on Mac/Linux).

Find your instance's **Public IPv4 address** in the EC2 console → Instances.

```bash
# On Linux / Mac:
chmod 400 ~/Downloads/ecocharge-key.pem
ssh -i ~/Downloads/ecocharge-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# On Windows (PowerShell):
ssh -i ~\Downloads\ecocharge-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Replace `YOUR_EC2_PUBLIC_IP` with the actual IP from AWS console.

### Step 6.4 — Install Docker

Run these commands on EC2:

```bash
# Update packages
sudo apt-get update

# Install Docker
sudo apt-get install -y docker.io

# Enable Docker on boot
sudo systemctl enable docker
sudo systemctl start docker

# Add your user to docker group (avoids sudo)
sudo usermod -aG docker ubuntu

# Apply group change — log out and back in
exit
```

SSH back in:

```bash
ssh -i ~/Downloads/ecocharge-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Verify Docker:

```bash
docker --version
docker compose version
```

Both should show version numbers.

### Step 6.5 — Create the project directory

```bash
mkdir -p ~/ecocharge
```

---

## 7. GitHub Secrets Configuration

GitHub Secrets are encrypted environment variables your workflow uses without exposing sensitive values.

### Step 7.1 — Go to your repo secrets page

1. Open your GitHub repo: `https://github.com/YOUR_USER/ecocharge`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### Step 7.2 — Add these 5 secrets

Add them one at a time. Name must match **exactly** (case-sensitive).

| Secret Name | What to put | Where to get it |
|-------------|-------------|-----------------|
| `GHCR_PAT` | Your GitHub PAT | Step 5 — starts with `ghp_` |
| `EC2_HOST` | EC2 public IP (e.g. `55.123.45.67`) | AWS Console → Instances |
| `EC2_USERNAME` | `ubuntu` | Default for Ubuntu EC2 |
| `EC2_SSH_KEY` | Entire `.pem` file contents | The file you downloaded when creating the key pair — open in Notepad and **copy everything** including `-----BEGIN` and `-----END` lines |
| `ENV_FILE` | Entire `.env` file contents | Open your project's `.env` in a text editor, copy everything |

> **Important for `ENV_FILE`:** Before copying, change these values for production:
> - `DEBUG=True` → `DEBUG=False`
> - `DJANGO_ALLOWED_HOSTS` → add your EC2 public IP (e.g. `localhost,127.0.0.1,django,55.123.45.67`)
> - `CORS_ALLOWED_ORIGINS` → add your Vercel URL (e.g. `https://ecocharge-abc123.vercel.app`)

### Step 7.3 — Verify

Your Actions secrets page should show:

```
GHCR_PAT       ********
EC2_HOST       ********
EC2_USERNAME   ********
EC2_SSH_KEY    ********
ENV_FILE       ********
```

---

## 8. Initial Deployment

### Step 8.1 — Push your code to GitHub

If not already on GitHub:

```bash
git remote add origin https://github.com/YOUR_USER/ecocharge.git
git branch -M main
git push -u origin main
```

### Step 8.2 — Trigger the backend CD workflow

```bash
git commit --allow-empty -m "Trigger first backend deployment"
git push origin main
```

### Step 8.3 — Watch the workflow

1. GitHub repo → **Actions** tab
2. You'll see the **CD** workflow running
3. Click it to see live logs

Each step turns green ✓ on success:

```
✓ Checkout repository
✓ Login to GitHub Container Registry
✓ Build production Docker images
✓ Tag and push images with git SHA
✓ Push latest tags
✓ Deploy to EC2
```

The first run takes **5-15 minutes** (building images from scratch, PyTorch is large).

### Step 8.4 — Vercel auto-deploys the frontend

While the backend builds, Vercel also detects the push and deploys the frontend (~1 min). Check your Vercel dashboard → Deployments.

### Step 8.5 — Verify backend is running

```bash
ssh -i ~/Downloads/ecocharge-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
cd ~/ecocharge
docker compose -f docker-compose.prod.yml ps
```

All containers should show `Up` or `Up (healthy)`:

```
NAME                    STATUS
ecocharge-postgres-1    Up (healthy)
ecocharge-redis-1       Up (healthy)
ecocharge-django-1      Up (healthy)
ecocharge-fastapi-1     Up (healthy)
ecocharge-nginx-1       Up (healthy)
ecocharge-celery_worker-1  Up
ecocharge-celery_beat-1    Up
```

### Step 8.6 — Test the API

```bash
curl http://YOUR_EC2_PUBLIC_IP/health
# Should return: OK

curl http://YOUR_EC2_PUBLIC_IP/api/
# Should return: {"detail":"Authentication credentials were not provided."}
# (401 is expected — means the API is working)
```

### Step 8.7 — Update Vercel environment variables

Go to Vercel → Project → Settings → Environment Variables. Update the URLs to point to your EC2 IP:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `http://YOUR_EC2_PUBLIC_IP/api` |
| `VITE_WS_URL` | `ws://YOUR_EC2_PUBLIC_IP/ws/stations/` |
| `VITE_WS_EVENTS_URL` | `ws://YOUR_EC2_PUBLIC_IP/ws/events/` |

Then redeploy from Vercel dashboard → Deployments → trigger a manual deploy.

### Step 8.8 — Visit your app

Open `https://ecocharge-xxx.vercel.app` in your browser.

---

## 9. Updating the Application

### Frontend update

```bash
# Make changes to frontend/ code
git add frontend/
git commit -m "Update button styles"
git push origin main
```

✅ Vercel auto-deploys. Done in ~1 minute.

### Backend update

```bash
# Make changes to django-backend/ or other backend code
git add django-backend/
git commit -m "Add new API endpoint"
git push origin main
```

✅ GitHub Actions builds → pushes to ghcr.io → deploys to EC2. Done in ~5-10 minutes.

### Update both at once

```bash
git add .
git commit -m "New feature: frontend + backend changes"
git push origin main
```

Both pipelines run in parallel:
- Vercel deploys the frontend (~1 min)
- GitHub Actions deploys the backend (~5-10 min)

---

## 10. Rollback Procedure

### Rollback Backend

If a backend deploy introduces a bug:

**Step 1:** Find the previous commit SHA:

```bash
git log --oneline -5
```

Or check the **Actions** tab — each run shows the commit SHA.

**Step 2:** SSH into EC2 and switch to the old images:

```bash
ssh -i ~/Downloads/ecocharge-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
cd ~/ecocharge

# Set the old SHA (replace this!)
OLD_SHA=abc123def456

# Login to ghcr.io
echo "$GHCR_PAT" | docker login ghcr.io -u "$GH_USERNAME" --password-stdin

# Pull old versions
for SERVICE in nginx django fastapi postgres; do
  docker pull "ghcr.io/$GH_USERNAME/ecocharge-$SERVICE:$OLD_SHA"
  docker tag "ghcr.io/$GH_USERNAME/ecocharge-$SERVICE:$OLD_SHA" "ghcr.io/$GH_USERNAME/ecocharge-$SERVICE:latest"
done

# Restart
docker compose -f docker-compose.prod.yml up -d
```

**Step 3:** Revert the code on GitHub (optional but recommended):

```bash
git revert HEAD
git push origin main
```

### Rollback Frontend

In Vercel dashboard → Deployments → find the previous deploy → click **...** → **Promote to Production**.

---

## 11. Troubleshooting

### CD workflow fails at "Login to GitHub Container Registry"

**Cause:** `GHCR_PAT` secret is wrong or missing scopes.
**Fix:** Regenerate the PAT with `write:packages`, `read:packages`, and `repo` scopes.

---

### CD workflow fails at "Deploy to EC2"

**Cause:** SSH can't connect.
**Fix:** 
1. Verify `EC2_HOST` has the correct IP
2. Verify `EC2_SSH_KEY` has the full `.pem` content (including `-----BEGIN` lines)
3. Test SSH manually:
```bash
ssh -i ~/Downloads/ecocharge-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

---

### `docker compose pull` fails on EC2

**Cause:** ghcr.io auth issue.
**Fix:** SSH into EC2 and test:
```bash
echo "$GHCR_PAT" | docker login ghcr.io -u "$GH_USERNAME" --password-stdin
docker pull ghcr.io/$GH_USERNAME/ecocharge-django:latest
```

---

### Site loads but API calls fail (401 or CORS errors)

**Cause:** CORS not configured, or frontend uses wrong API URL.
**Fix:**
1. Check Vercel env vars — `VITE_API_URL` must point to EC2
2. Check Django `CORS_ALLOWED_ORIGINS` in the `.env` file — must include the Vercel URL

---

### Container keeps restarting

Check logs:
```bash
ssh -i ~/Downloads/ecocharge-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
cd ~/ecocharge

docker compose -f docker-compose.prod.yml logs --tail=50 django
docker compose -f docker-compose.prod.yml logs --tail=50 nginx
```

---

### EC2 runs out of disk space

```bash
# Clean up everything unused
docker system prune -af --volumes

# Check space
df -h
```

---

## 12. Useful Commands

### On EC2

| Command | What it does |
|---------|-------------|
| `docker compose -f ~/ecocharge/docker-compose.prod.yml ps` | List all containers with status |
| `docker compose -f ~/ecocharge/docker-compose.prod.yml logs --tail=50 django` | See last 50 lines of Django logs |
| `docker compose -f ~/ecocharge/docker-compose.prod.yml logs -f nginx` | Follow nginx logs in real-time |
| `docker compose -f ~/ecocharge/docker-compose.prod.yml restart django` | Restart Django only |
| `docker compose -f ~/ecocharge/docker-compose.prod.yml exec django bash` | Open a shell inside Django container |
| `docker compose -f ~/ecocharge/docker-compose.prod.yml exec django python manage.py check --deploy` | Run Django deployment checks |
| `docker stats` | See CPU/memory usage of all containers |
| `docker system df` | Check Docker disk usage |

### On your local machine

| Command | What it does |
|---------|-------------|
| `curl http://YOUR_EC2_IP/health` | Check if backend is alive |
| `curl -I http://YOUR_EC2_IP/api/` | Check API headers (expect 401) |
| `ssh -i ~/Downloads/ecocharge-key.pem ubuntu@YOUR_EC2_IP` | SSH into EC2 |

### Quick health check script

Save this as `check-deploy.sh` on your local machine:

```bash
#!/bin/bash
EC2_IP=$1
echo "=== Backend Health Check ==="
curl -s "http://$EC2_IP/health"
echo ""
curl -s -o /dev/null -w "API Status: %{http_code}\n" "http://$EC2_IP/api/"
echo "=== Done ==="
```

Run with: `bash check-deploy.sh YOUR_EC2_IP`

---

## Appendix: Environment Variables for Production

Your production `.env` (the one stored as the `ENV_FILE` secret) should have at minimum:

```env
DATABASE_URL=postgresql://ecouser:ecopass@postgres:5432/ecocharge
REDIS_URL=redis://redis:6379/0
DJANGO_SECRET_KEY=my-super-secret-key-change-later
DEBUG=False
DJANGO_BASE=http://django:8000
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,django,YOUR_EC2_PUBLIC_IP
CORS_ALLOWED_ORIGINS=https://ecocharge-xxx.vercel.app
CSRF_TRUSTED_ORIGINS=https://ecocharge-xxx.vercel.app
```

Replace:
- `YOUR_EC2_PUBLIC_IP` with your actual EC2 IP
- `ecocharge-xxx.vercel.app` with your actual Vercel URL
- `DJANGO_SECRET_KEY` with a long random string (generate one at https://djecrety.ir)
