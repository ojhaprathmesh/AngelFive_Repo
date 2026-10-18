# @angelfive/frontend

Next.js 15 dashboard UI for the AngelFive DSFM platform. Provides market discovery, personalized interactive watchlists, intensive DSFM analytics (ARIMA/LSTM), portfolio optimization (Markowitz), and a real-time notification system.

## 🚀 Tech Stack & Engineering

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (Strict Mode) |
| Architecture | Feature-Oriented Pattern (Decoupled Hooks & Presentational UI) |
| Styling | Tailwind CSS 4 + Radix UI primitives |
| Charts | `lightweight-charts` (TradingView) |
| Auth | Firebase Web SDK (`signInWithCustomToken`) |
| State | React context (`AuthContext`, `NotificationContext`) + SWR |
| Realtime | Server-Sent Events (SSE) via `@microsoft/fetch-event-source` |

## 🏗️ Architectural Decisions

This frontend aggressively prioritizes maintainability and performance through architectural decomposition:
- **Modular Monoliths:** Large UI pages (like the Watchlist and Returns Analysis) are broken down into **Orchestrator Components**, **Custom Hooks** (for side-effects/data fetching), and **Presentational Tabs/Cards**. This ensures high reuse and isolated re-renders.
- **Strict Data Types:** All cross-service communication with the ML engine and Backend is enforced via `@/features/dsfm/types` and `@/features/market/types`.
- **API Proxying:** Next.js rewrites proxy `/api/*` to the Express backend. The client *never* communicates directly with the Python ML-Service or third-party APIs, enforcing security.
- **SSE over WebSocket:** Push notifications and live ticker updates utilize lightweight Server-Sent Events (SSE) with token-based authorization.
- **Context-Lite State:** Redux/Zustand was intentionally avoided. Auth and notifications exist in React Context, while heavily dynamic API responses utilize SWR caching.

## 🚦 Local Setup

### 1. Install dependencies
From the **repository root**:
```bash
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Provide the required Firebase credentials and Backend API URL.

### 3. Start the Dev Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).

## 📂 Project Structure

```text
frontend/
├── app/
│   ├── login/                  # Auth pages
│   └── dashboard/
│       ├── layout.tsx          # Dashboard shell
│       ├── watchlist/          # Orchestrator for personalized watchlists
│       ├── dsfm/               # Orchestrator for Analytics (ADF, TS, Sentiment)
│       └── portfolio/          # Orchestrator for MPT Optimization
├── components/
│   ├── ui/                     # Generic Radix/Tailwind components
│   ├── dsfm/                   
│   │   ├── returns-analysis/   # Decomposed Feature: Hooks, Tabs, Orchestrator
│   │   └── portfolio-optimization/ # Decomposed Feature: Charts, Constant Logic
│   └── watchlist/              # Decomposed Feature: Modals, Sidebar, List
├── contexts/
│   ├── auth-context.tsx        # Session state management
│   └── notification-context.tsx# SSE connection manager
├── lib/
│   └── types/                  # Strict Type definitions for cross-service payloads
└── Dockerfile                  # Multi-stage production standalone build
```

## 🐳 Docker Deployment

The frontend ships with a highly optimized 3-stage Dockerfile:

1. **deps** — Installs `node_modules` with pnpm.
2. **builder** — Compiles via `next build` to create a lightweight standalone output.
3. **runner** — Secure minimal Alpine image serving only the compiled `server.js`.

Build and run via Docker Compose from the repo root:

```bash
# Development (hot-reload)
docker compose -f docker-compose.dev.yml up frontend

# Production
docker compose up frontend
```
