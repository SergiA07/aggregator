# Production Deployment Guide

This guide covers deploying the Portfolio Aggregator to production using:
- **Cloudflare Pages** - React frontend (free, unlimited bandwidth)
- **Railway** - NestJS API + Python service (free tier: $5 trial credits)
- **Supabase** - Hosted PostgreSQL database + Auth (already configured)
- **GitHub Actions** - Automated CI/CD (free for public repos)

## Deployment Options

| Option | Description |
|--------|-------------|
| **Automated (Recommended)** | Push to `main` branch → GitHub Actions deploys everything |
| **Manual** | Deploy each service individually via CLI |

---

## Prerequisites

1. **Accounts needed:**
   - [Railway account](https://railway.com) (free trial, no credit card required)
   - [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
   - [Supabase account](https://supabase.com) (you likely already have this)

2. **CLI tools:**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login to Railway
   railway login
   ```

---

## Step 1: Set Up Supabase (Production Database)

If you're still using local Supabase, create a hosted project:

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your credentials (Settings → API → API Keys):
   - **Project URL**: `https://your-project.supabase.co`
   - **Publishable Key** (`sb_publishable_...`): For frontend
   - **Secret Key** (`sb_secret_...`): For backend (click eye icon to reveal)
   - **Database URL**: Found in Settings → Database → Connection string (URI)

3. Push your schema to production:
   ```bash
   # Update your .env with production DATABASE_URL
   cd packages/database
   bun run db:push
   ```

---

## Step 2: Deploy API to Railway

### 2.1 Create a Railway project

```bash
# Login if you haven't
railway login

# Create a new project
railway init
# Project name: portfolio-aggregator
```

### 2.2 Create the API service

1. Go to [railway.com/dashboard](https://railway.com/dashboard)
2. Open your project
3. Click **+ New** → **GitHub Repo** → Select your repo
4. Configure the service:
   - **Name**: `portfolio-api`
   - **Root Directory**: `apps/api`
   - **Build Command**: `bun install && bun run build`
   - **Start Command**: `bun run start:prod`

### 2.3 Set environment variables

In Railway dashboard → your service → **Variables**:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
PORT=3333
NODE_ENV=production
```

### 2.4 Generate a domain

In Railway → your service → **Settings** → **Networking** → **Generate Domain**

Your API will be available at: `https://portfolio-api-production.up.railway.app`

---

## Step 3: Deploy Python Service to Railway

### 3.1 Add the Python service

1. In the same Railway project, click **+ New** → **GitHub Repo**
2. Select your repo again
3. Configure:
   - **Name**: `portfolio-python`
   - **Root Directory**: `apps/python-service`

### 3.2 Set environment variables (if any)

Add any secrets your Python service needs in the Variables tab.

### 3.3 Generate a domain

Your Python service will be available at: `https://portfolio-python-production.up.railway.app`

---

## Step 4: Deploy Web to Cloudflare Pages

### 4.1 Connect your repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Click **Create a project** → **Connect to Git**
3. Select your repository
4. Configure the build settings:

| Setting | Value |
|---------|-------|
| Framework preset | Vite |
| Build command | `cd apps/web && bun install && bun run build` |
| Build output directory | `apps/web/dist` |
| Root directory | `/` |

### 4.2 Set environment variables

In Cloudflare Pages → Settings → Environment variables:

```
VITE_API_URL=https://portfolio-api-production.up.railway.app
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### 4.3 Deploy

Click **Save and Deploy**. Cloudflare will automatically deploy on every push to your main branch.

Your web app will be available at: `https://your-project.pages.dev`

---

## Step 5: Configure CORS

Update your API to allow requests from your Cloudflare Pages domain:

In `apps/api/src/main.ts`, ensure CORS is configured for production:

```typescript
app.enableCors({
  origin: [
    'http://localhost:5173',           // Local development
    'https://your-project.pages.dev',  // Cloudflare Pages
    'https://yourdomain.com',          // Custom domain (optional)
  ],
  credentials: true,
});
```

Redeploy the API after making changes.

---

## Custom Domains (Optional)

### Cloudflare Pages
1. Go to your Pages project → Custom domains
2. Add your domain (e.g., `app.yourdomain.com`)
3. Follow DNS configuration instructions

### Railway
1. Go to your service → Settings → Networking → Custom Domain
2. Add your domain and follow the DNS instructions

---

## Monitoring & Logs

### Railway
- View logs in Railway Dashboard → your service → **Logs**
- Monitor resource usage in the **Metrics** tab

### Cloudflare Pages
- View build logs in Cloudflare Dashboard → Pages → your project → Deployments

---

## Cost Estimation

| Service | Free Tier | Paid (if exceeded) |
|---------|-----------|-------------------|
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds/mo | N/A |
| **Railway** | $5 trial credits (30 days), then free tier or $5/mo Hobby | Usage-based |
| **Supabase** | 500MB DB, 2GB bandwidth, 50k auth users | $25/mo Pro plan |

**Total for hobby project: $0-5/month** (within free tiers)

---

## Troubleshooting

### API not starting
- Check logs in Railway dashboard
- Common issues:
  - Missing env vars: Check Variables tab
  - Build failed: Check build logs

### Database connection issues
- Ensure DATABASE_URL is set correctly in Railway Variables
- Check Supabase dashboard for connection limits
- Verify IP allowlist in Supabase (Settings → Database)

### CORS errors
- Add your production domain to the CORS origin list
- Redeploy the API

### Build failures on Cloudflare
- Check that `bun` is available (Cloudflare supports it natively)
- Verify environment variables are set
- Check build logs for specific errors

---

## Automated Deployment with GitHub Actions

The project includes GitHub Actions workflows that automatically deploy services when you push to `main`.

### Workflows

| Workflow | Trigger | Deploys |
|----------|---------|---------|
| `ci.yml` | All pushes/PRs | Lint + Type check |
| `deploy-api.yml` | Changes to `apps/api/**` or `packages/database/**` | API to Railway |
| `deploy-python.yml` | Changes to `apps/python-service/**` | Python to Railway |
| `deploy-web.yml` | Changes to `apps/web/**` | Web to Cloudflare |

### One-Time Setup

#### 1. Get your API tokens

**Railway:**
1. Go to [railway.com/account/tokens](https://railway.com/account/tokens)
2. Create a new token
3. Copy the token

**Cloudflare:**
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a token with **Cloudflare Pages: Edit** permission
3. Note your **Account ID** from the dashboard URL or Workers & Pages overview

#### 2. Add secrets to GitHub

Go to your repo → Settings → Secrets and variables → Actions

**Secrets (sensitive):**
| Secret Name | Value |
|-------------|-------|
| `RAILWAY_TOKEN` | Your Railway API token |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key (`sb_publishable_...`) |

**Variables (non-sensitive):**
| Variable Name | Value |
|---------------|-------|
| `VITE_API_URL` | `https://portfolio-api-production.up.railway.app` |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |

#### 3. Link Railway services

Before GitHub Actions can deploy, link your services in Railway:

```bash
# In your project root
railway link

# Select your project and service when prompted
```

#### 4. Deploy!

Now just push to `main`:
```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

GitHub Actions will:
1. ✅ Run lint and type checks
2. ✅ Deploy API to Railway (if API files changed)
3. ✅ Deploy Python service to Railway (if Python files changed)
4. ✅ Build and deploy Web to Cloudflare Pages (if web files changed)

### Workflow Overview

```
Push to main
    │
    ├──────────────────────────────────────────┐
    │                                          │
    ▼                                          ▼
┌─────────┐                            (Path-filtered)
│   CI    │ ─── Lint + Type check             │
└─────────┘                                    │
                                               │
         ┌────────────────┬────────────────────┤
         │                │                    │
         ▼                ▼                    ▼
   ┌──────────┐    ┌───────────┐       ┌──────────┐
   │   API    │    │  Python   │       │   Web    │
   │ Railway  │    │  Railway  │       │ CF Pages │
   └──────────┘    └───────────┘       └──────────┘
```

### Manual Trigger

You can also trigger deployments manually:
1. Go to Actions tab in GitHub
2. Select the workflow you want to run
3. Click "Run workflow"
