# InsightFlow 🚀

> Intelligent B2B Customer Intelligence and Feedback Analytics Platform scaffolded for the **Build Battle 2026** hackathon.

## Architecture & Tech Stack

```
InsightFlow/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # AppLayout, Collapsible Sidebar, TopNavbar
│   │   │   └── ui/             # Reusable Design System (Button, Card, Badge, Input, Select, Textarea)
│   │   ├── pages/              # Overview, Feedback, Insights, Actions, Reports, Settings
│   │   ├── types/              # TypeScript types & API interfaces
│   │   ├── App.tsx             # React Router routing & application shell
│   │   ├── index.css           # Tailwind CSS imports & base theme styles
│   │   └── main.tsx            # React application entry point
│   ├── .env.example            # Frontend environment variable template
│   ├── package.json            # React 19, Vite, Tailwind CSS, Lucide, Recharts, Framer Motion
│   └── vite.config.ts          # Vite plugin configuration & /api development proxy
│
├── server/                     # Backend API Server
│   ├── src/
│   │   ├── db/
│   │   │   ├── migrations/     # PostgreSQL SQL schema migrations
│   │   │   │   └── 001_initial_schema.sql
│   │   │   ├── client.ts       # Reusable Supabase & Postgres pool client with pagination
│   │   │   ├── config.ts       # Database configuration parser & missing-variable checks
│   │   │   ├── health.ts       # Database health-check service
│   │   │   └── migrate.ts      # Migration execution runner
│   │   └── index.ts            # Express server, health check endpoints, error handling
│   ├── .env.example            # Backend environment variable template
│   ├── package.json            # Node.js, Express, TypeScript, tsx, Supabase, pg, CORS, dotenv
│   └── tsconfig.json           # NodeNext ESM TypeScript configuration
│
├── .env.example                # Global environment variable documentation
├── .gitignore                  # Git ignore rules for dependencies, env, and build artifacts
└── package.json                # Root orchestration scripts with concurrently
```

### Backend Database Architecture (Supabase PostgreSQL)
- **Database Client**: Reusable `@supabase/supabase-js` client + `pg` connection pool with lazy initialization.
- **Graceful Unconfigured Mode**: Server boots cleanly even if database credentials are not present in `.env`. Database-dependent endpoints report structured `503 Service Unavailable` with missing variables instead of crashing or serving fake data.
- **Efficient Pagination**: `parsePaginationParams` with `LIMIT`/`OFFSET` and keyset support prevents loading unbounded rows into memory.
- **Separate Raw & AI Layers**: Raw customer feedback (`feedback`) is stored in an immutable table, completely decoupled from AI-generated sentiment and clustering analyses (`feedback_analysis`).

---

## Database Schema (`001_initial_schema.sql`)

| Table | Description | Key Constraints & Indexes |
| :--- | :--- | :--- |
| `dataset_versions` | Immutable customer feedback version snapshots | Unique `version_tag`, timestamp indexing |
| `analysis_runs` | Tracks batch & streaming AI clustering jobs | Status checks (`pending`, `running`, `completed`), duration, token tracking |
| `feedback` | Raw ingested customer verbatim signals | Deduplication unique `(source, external_id)`, GIN index on `metadata` |
| `feedback_analysis` | AI sentiment, urgency scores, and topics | Foreign key to `feedback(id)` ON DELETE CASCADE, unique `(feedback_id, model_version)` |
| `issues` | Actionable initiatives & triage tickets | Unique `issue_code`, status/priority compound index |
| `issue_feedback` | Junction table connecting issues to feedback citations | Unique composite `(issue_id, feedback_id)` |
| `reports` | Executive briefings & digests | Unique `report_code`, type/status index, JSONB payload |

---

## Environment Variables

Copy `.env.example` templates to `.env`:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

### Required Variables Reference

```env
# HTTP Server (server/.env)
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Supabase API (server/.env) - Option A
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key
SUPABASE_ANON_KEY=your-supabase-anon-public-key

# Direct PostgreSQL Pooler (server/.env) - Option B (Required for migrations)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres

# Client (client/.env)
VITE_API_URL=http://localhost:5000/api
```

---

## Running the Project

```bash
# Install dependencies across all workspaces
npm run install:all

# Run both frontend & backend concurrently
npm run dev

# Run PostgreSQL migrations (requires DATABASE_URL in server/.env)
npm run db:migrate
```

### API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns server health status, uptime, environment, and DB configuration state |
| `GET` | `/api/health/db` | Dedicated database health check. Returns `200` with latency if connected, `503` if unconfigured or unreachable |
| `GET` | `/api/feedback` | Paginated feedback query (`?page=1&pageSize=25`). Returns `503` if database is unconfigured |
