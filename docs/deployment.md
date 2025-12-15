# Production Deployment Guide

This guide covers deploying the Portfolio Aggregator to production using:
- **Cloudflare Pages** - React frontend (free, unlimited bandwidth)
- **Fly.io** - NestJS API + Python service (free tier available)
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
   - [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
   - [Fly.io account](https://fly.io/app/sign-up) (free tier: 3 shared VMs)
   - [Supabase account](https://supabase.com) (you likely already have this)

2. **CLI tools:**
   ```bash
   # Install Fly.io CLI
   curl -L https://fly.io/install.sh | sh

   # Login to Fly.io
   fly auth login
   ```

---

## Step 1: Set Up Supabase (Production Database)

If you're still using local Supabase, create a hosted project:

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your credentials:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon Key**: Found in Settings → API
   - **Database URL**: Found in Settings → Database → Connection string (URI)

3. Push your schema to production:
   ```bash
   # Update your .env with production DATABASE_URL
   cd packages/database
   bun run db:push
   ```

---

## Step 2: Deploy API to Fly.io

### 2.1 Create the Fly.io app

```bash
cd apps/api

# Create the app (first time only)
fly launch --no-deploy

# When prompted:
# - App name: portfolio-api (or your preferred name)
# - Region: Choose closest to you (e.g., mad for Madrid)
# - Don't set up PostgreSQL (we use Supabase)
# - Don't set up Redis
```

### 2.2 Set environment variables

```bash
# Set your production secrets
fly secrets set DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
fly secrets set SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
fly secrets set SUPABASE_ANON_KEY="your-anon-key"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 2.3 Deploy

```bash
# Deploy from the monorepo root (Dockerfile needs access to packages/)
cd ../..
fly deploy --config apps/api/fly.toml
```

### 2.4 Verify deployment

```bash
# Check app status
fly status -a portfolio-api

# View logs
fly logs -a portfolio-api

# Test the health endpoint
curl https://portfolio-api.fly.dev/health
```

Your API will be available at: `https://portfolio-api.fly.dev`

---

## Step 3: Deploy Python Service to Fly.io

### 3.1 Create the Fly.io app

```bash
cd apps/python-service

# Create the app
fly launch --no-deploy

# App name: portfolio-python
# Region: Same as API
```

### 3.2 Set environment variables (if any)

```bash
fly secrets set SOME_SECRET="value"
```

### 3.3 Deploy

```bash
fly deploy
```

Your Python service will be available at: `https://portfolio-python.fly.dev`

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
VITE_API_URL=https://portfolio-api.fly.dev
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
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

Redeploy the API after making changes:
```bash
fly deploy --config apps/api/fly.toml
```

---

## Custom Domains (Optional)

### Cloudflare Pages
1. Go to your Pages project → Custom domains
2. Add your domain (e.g., `app.yourdomain.com`)
3. Follow DNS configuration instructions

### Fly.io
```bash
# Add custom domain
fly certs create api.yourdomain.com -a portfolio-api

# Add the CNAME record shown to your DNS
```

---

## Monitoring & Logs

### Fly.io
```bash
# Real-time logs
fly logs -a portfolio-api

# SSH into container (for debugging)
fly ssh console -a portfolio-api

# Check metrics
fly status -a portfolio-api
```

### Cloudflare Pages
- View build logs in Cloudflare Dashboard → Pages → your project → Deployments

---

## Cost Estimation

| Service | Free Tier | Paid (if exceeded) |
|---------|-----------|-------------------|
| **Cloudflare Pages** | Unlimited bandwidth, 500 builds/mo | N/A |
| **Fly.io** | 3 shared VMs, 160GB transfer | ~$2-5/mo per extra VM |
| **Supabase** | 500MB DB, 2GB bandwidth, 50k auth users | $25/mo Pro plan |

**Total for hobby project: $0/month** (within free tiers)

---

## Troubleshooting

### API not starting
```bash
# Check logs
fly logs -a portfolio-api

# Common issues:
# - Missing env vars: fly secrets list
# - Build failed: Check Dockerfile paths
```

### Database connection issues
- Ensure DATABASE_URL is set correctly in Fly secrets
- Check Supabase dashboard for connection limits
- Verify IP allowlist in Supabase (Settings → Database → Connection Pooling)

### CORS errors
- Add your production domain to the CORS origin list
- Redeploy the API

### Build failures on Cloudflare
- Check that `bun` is available (Cloudflare supports it natively)
- Verify environment variables are set
- Check build logs for specific errors

---

## Automated Deployment with GitHub Actions

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys all services when you push to `main`.

### One-Time Setup

#### 1. Get your API tokens

**Fly.io:**
```bash
# Generate a deploy token
fly tokens create deploy -x 999999h

# Copy the token (starts with FlyV1...)
```

**Cloudflare:**
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a token with **Cloudflare Pages: Edit** permission
3. Note your **Account ID** from the dashboard URL or Workers & Pages overview

#### 2. Add secrets to GitHub

Go to your repo → Settings → Secrets and variables → Actions

**Secrets (sensitive):**
| Secret Name | Value |
|-------------|-------|
| `FLY_API_TOKEN` | Your Fly.io deploy token |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

**Variables (non-sensitive):**
| Variable Name | Value |
|---------------|-------|
| `VITE_API_URL` | `https://portfolio-api.fly.dev` |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |

#### 3. Initial deployment

Before GitHub Actions can deploy, you need to create the Fly.io apps once:

```bash
# Create API app
cd apps/api
fly launch --no-deploy --name portfolio-api --region mad

# Set secrets
fly secrets set DATABASE_URL="..." SUPABASE_URL="..." SUPABASE_ANON_KEY="..."

# Create Python app
cd ../python-service
fly launch --no-deploy --name portfolio-python --region mad
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
2. ✅ Deploy API to Fly.io
3. ✅ Deploy Python service to Fly.io
4. ✅ Build and deploy Web to Cloudflare Pages

### Workflow Overview

```
Push to main
    │
    ▼
┌─────────┐
│  Test   │ ─── Lint + Type check
└────┬────┘
     │
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
┌─────────┐  ┌───────────┐  ┌─────────┐
│   API   │  │  Python   │  │   Web   │
│ Fly.io  │  │  Fly.io   │  │  CF Pages│
└─────────┘  └───────────┘  └─────────┘
```

### Manual Trigger

You can also trigger deployments manually:
1. Go to Actions tab in GitHub
2. Select "Deploy" workflow
3. Click "Run workflow"
