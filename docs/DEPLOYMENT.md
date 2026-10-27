# PrisonGuard Independent Deployment Guide

This guide covers deploying PrisonGuard as **three independent production services**:
1. **Admin Portal:** Vercel (Project 1)
2. **Facility Simulator:** Vercel (Project 2)
3. **Core Backend:** Render / Railway / Docker / Self-Hosted VPS

---

## 🚀 Part 1: Deploying the Core Backend

### Option A: Deploy on Render (Recommended)

1. **Connect Repository:** Log into [Render Dashboard](https://dashboard.render.com/) and create a new **Web Service** from your GitHub repository.
2. **Configure Settings:**
   - **Name:** `prisonguard-server`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
   - **Health Check Path:** `/health`
3. **Environment Variables on Render:**
   | Variable | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production security & origin checks |
   | `PORT` | `5000` | Render assigns ports dynamically or routes 5000 |
   | `JWT_SECRET` | *(Generate a random 32+ character string)* | Critical for JWT token signing |
   | `ALLOWED_ORIGINS` | `https://your-admin.vercel.app,https://your-sim.vercel.app` | Comma-separated frontend domains |
   | `ADMIN_ORIGIN` | `https://your-admin.vercel.app` | Admin portal domain |
   | `SIMULATOR_ORIGIN` | `https://your-sim.vercel.app` | Simulator domain |
   | `DATA_STORE_PATH` | `./data/prisonguard_store.json` | Persistent store file path |

*Note on Free Tier Sleep:* If using Render's free tier, free instances sleep after 15 minutes of inactivity. For continuous WebSocket telemetry, use a paid starter tier or keep-alive cron job.

---

### Option B: Deploy with Docker

A production-ready multi-stage `Dockerfile` is provided in `server/Dockerfile`.

```bash
# 1. Build Docker image
cd server
docker build -t prisonguard-server:latest .

# 2. Run container
docker run -d \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_production_secret_key_here \
  -e ALLOWED_ORIGINS=https://admin.yourdomain.com,https://sim.yourdomain.com \
  -v prisonguard_data:/app/data \
  --name prisonguard-backend \
  prisonguard-server:latest
```

---

## 🖥️ Part 2: Deploying Website A (Admin Portal on Vercel)

1. In [Vercel Dashboard](https://vercel.com/dashboard), click **Add New Project**.
2. Select your repository.
3. Configure **Root Directory**:
   - Click *Edit* next to Root Directory and select: `apps/admin`
4. **Build & Development Settings:**
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Environment Variables:**
   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://your-prisonguard-server.onrender.com` |
   | `VITE_WS_URL` | `https://your-prisonguard-server.onrender.com` |
   | `VITE_SIMULATOR_URL` | `https://your-simulator.vercel.app` |
6. Click **Deploy**. Vercel will build the React SPA and apply the `vercel.json` rewrites.

---

## 🗺️ Part 3: Deploying Website B (Facility Simulator on Vercel)

1. In [Vercel Dashboard](https://vercel.com/dashboard), click **Add New Project** again.
2. Select the **same** repository.
3. Configure **Root Directory**:
   - Click *Edit* and select: `apps/simulator`
4. **Build & Development Settings:**
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Environment Variables:**
   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://your-prisonguard-server.onrender.com` |
   | `VITE_WS_URL` | `https://your-prisonguard-server.onrender.com` |
   | `VITE_ADMIN_URL` | `https://your-admin.vercel.app` |
6. Click **Deploy**.

---

## 🔒 Part 4: Updating Backend CORS with Production Domains

Once Vercel assigns domains to both frontends (e.g., `https://prisonguard-admin.vercel.app` and `https://prisonguard-sim.vercel.app`), go back to your **Render / Backend Environment Variables**:

Set:
```env
ALLOWED_ORIGINS=https://prisonguard-admin.vercel.app,https://prisonguard-sim.vercel.app
ADMIN_ORIGIN=https://prisonguard-admin.vercel.app
SIMULATOR_ORIGIN=https://prisonguard-sim.vercel.app
```
Redeploy the backend service. CORS and WebSocket connections will now be strictly restricted to your production domains.
