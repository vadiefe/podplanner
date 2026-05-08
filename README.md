# 🎙 Podcast Media Planner

AI-powered podcast media planning tool. Upload rate cards, enter a brand brief, and get an instant media plan with budget allocation, impressions, and export to CSV/PDF.

---

## Quick start (local)

### 1. Prerequisites
- [Node.js 18+](https://nodejs.org)
- An [Anthropic API key](https://console.anthropic.com)

### 2. Install
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Open `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

### 4. Run in development
```bash
npm run dev
```
Opens at **http://localhost:5173**

The React frontend proxies `/api` requests to the Express backend on port 3001.

---

## How to use

1. **Rate Cards** — Upload CSV, XLS, XLSX, or PDF files from your podcast ad networks. Map the column headers to show name, CPM, listeners, etc. Add new files any time as you receive them.

2. **Brand Brief** — Fill in the brand name, description, target audience, budget, and flight details.

3. **Media Plan** — Claude analyses your show library and generates a recommended plan. Adjust budget allocations per show manually. Remove any shows you don't want.

4. **Export** — Download as a CSV spreadsheet or an HTML report (open in browser → Print → Save as PDF).

---

## Deployment

### Option A: Railway (recommended — easiest)
1. Push this repo to GitHub
2. Create a new project at [railway.app](https://railway.app)
3. Connect your GitHub repo
4. Add `ANTHROPIC_API_KEY` in Railway's environment variables
5. Railway auto-detects Node.js and runs `npm start`

### Option B: Render
1. Push to GitHub
2. New Web Service at [render.com](https://render.com)
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add `ANTHROPIC_API_KEY` as an environment variable

### Option C: Fly.io
```bash
npm install -g flyctl
fly auth login
fly launch
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

### Option D: VPS / server
```bash
npm install
npm run build
npm start  # Serves both API and built frontend on PORT (default 3001)
```

For production, put Nginx or Caddy in front and use PM2 to keep the process running:
```bash
npm install -g pm2
pm2 start api/server.js --name podcast-planner
pm2 save
```

---

## File structure

```
podcast-media-planner/
├── api/
│   └── server.js          # Express backend — file parsing + Anthropic API
├── src/
│   ├── App.jsx             # Root component + navigation
│   ├── components/
│   │   └── UI.jsx          # Shared UI components
│   └── pages/
│       ├── RateCardPage.jsx   # Step 1: Upload & manage rate cards
│       ├── BriefPage.jsx      # Step 2: Brand brief form
│       ├── PlanPage.jsx       # Step 3: AI plan + editable table + chart
│       └── ExportPage.jsx     # Step 4: CSV + HTML/PDF export
├── .env.example
├── package.json
└── vite.config.js
```

---

## Supported file formats

| Format | How it's parsed |
|--------|----------------|
| `.csv` | PapaParse (client-side) |
| `.xlsx` / `.xls` | SheetJS (client-side) |
| `.pdf` | Claude vision API (server-side) — extracts show data automatically |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `PORT` | No | Server port (default: 3001) |
