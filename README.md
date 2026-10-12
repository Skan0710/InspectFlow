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

### Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns server health status, uptime, environment, and DB configuration state |
| `GET` | `/api/health/db` | Dedicated database health check. Returns `200` with latency if connected, `503` if unconfigured |
| `GET` | `/api/feedback` | Paginated feedback query (`?page=1&pageSize=25`) |
| `GET` | `/api/adaption/status` | Safe configuration status with masked API key and validation state |
| `POST` | `/api/adaption/prepare` | Prepares deduplicated prompt-completion pairs with category context metadata |
| `POST` | `/api/adaption/estimate` | Computes credit consumption and USD cost upfront |
| `POST` | `/api/adaption/runs` | Initiates Adaption job (requires explicit confirmation for live credit runs) |
| `GET` | `/api/adaption/runs` | Retrieves all persisted Adaption runs |
| `GET` | `/api/adaption/runs/:id` | Retrieves detailed run metrics and before/after sample pairs |
| `POST` | `/api/adaption/runs/:id/sync` | Syncs remote status and quality evaluation from Adaption API |
| `GET` | `/api/adaption/runs/:id/export` | Streams RFC-4180 CSV or JSONL export |
| `GET` | `/api/adaption/exemplars` | Returns validated few-shot exemplars and library version |
| `POST` | `/api/adaption/exemplars/toggle` | Enables or disables exemplar injection in downstream AI analysis |
| `POST` | `/api/adaption/evaluate` | Executes empirical benchmark comparing baseline zero-shot vs. adapted few-shot |
| `GET` | `/api/adaption/evaluation` | Retrieves latest persisted benchmark comparison |

---

## Adaption Labs Integration & Feedback Pipeline

InsightFlow integrates [Adaption Labs](https://docs.adaptionlabs.ai/) directly into its core intelligence workflow:

```
[Customer Feedback CSV / DB (7,000 rows)]
                   │
                   ▼
       [1. Dataset Preparation]
   - Deduplicates identical reviews (~320 unique)
   - Preserves all original records & IDs in DB
   - Formats SFT prompt-completion pairs
                   │
                   ▼
        [2. Upfront Estimation]
   - Calculates credit & USD cost upfront
   - Requires explicit user authorization
                   │
                   ▼
         [3. Adaption Execution]
   - POST /api/v1/datasets (Remote Adaption API)
   - Verified local simulation fallback (ADAPTION_MOCK=true)
   - Idempotency & duplicate-run deduplication
                   │
                   ▼
        [4. Output Validation]
   - Schema validation of completions
   - Rejection of malformed or invalid JSON
                   │
                   ▼
        [5. Exemplar Library]
   - Versioned repository of approved patterns
   - Diverse category coverage
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
[6. Downstream AI Prompting] [7. Empirical Evaluation]
- Injects validated patterns   - Leakage-free benchmark
- Calibrated category/topic    - Baseline vs. Adapted
- Preserves zero-shot fallback - Valid output, grounding & latency
```

### Empirical Evaluation Methodology
- **Leakage Prevention**: Evaluation reviews are strictly filtered to exclude any exemplar IDs or verbatim review texts present in the exemplar library.
- **Fair Comparison**: The exact same test feedback records are analyzed with:
  1. **Baseline**: Zero-shot prompt with system instructions.
  2. **Adaption-Enhanced**: Few-shot prompt containing validated Adaption exemplars.
- **Measured Metrics**:
  - `Structured Output Validity`: % of outputs passing strict JSON schema checks.
  - `Category Agreement`: % consistency with source CSV category metadata (context consistency, not verified external ground truth).
  - `Evidence Grounding Rate`: % of evidence phrases that are verbatim substrings in the original review.
  - `Average Confidence`: Calibrated model confidence score.
  - `Average Latency`: Processing speed in milliseconds.

### Transparent Architecture Disclaimers
1. **In-Context Adaptation vs. Fine-Tuning**: Adaption dataset adaptation generates validated instruction patterns used for in-context few-shot prompt guidance. It does not modify LLM neural network weights.
2. **Category Context**: Source CSV category labels are domain context from customer review imports, not independently verified ground-truth annotations.
3. **Zero Data Loss**: Preparing the adaptation corpus never deletes or alters original records in the customer feedback database.

---

## Judge Demonstration Sequence

Follow this sequence to inspect and verify the integration:

1. **Step 1 — Feedback Explorer (`/feedback`)**:
   - Inspect the imported customer feedback records. Observe 7,000 raw rows containing repeated reviews across different sources and categories.
2. **Step 2 — Open Adaption Labs (`/adaption`)**:
   - Note the Integration Banner displaying connection status, endpoint, and masked API key.
3. **Step 3 — Prepare Adaptation Dataset**:
   - Click **Prepare** under Step 1.
   - Observe deduplication metrics: 7,000 source records produce ~320 unique reviews, filtering duplicates while preserving all original database records.
4. **Step 4 — Review Upfront Estimate**:
   - Click **Estimate** under Step 2.
   - Inspect required credits and approximate USD cost before launching any operation.
5. **Step 5 — Run Adaption Workflow**:
   - Click **Run Adaption Workflow**.
   - For live API runs, note the credit authorization checkbox required before launch.
   - Alternatively, toggle **Simulation Mode** for instant local evaluation without consuming credits.
   - Inspect quality grades, relative improvement, and sample before/after pairs.
6. **Step 6 — Run Empirical Benchmark Evaluation**:
   - Navigate to the **Empirical Evaluation Benchmark** tab and click **Run Benchmark Evaluation**.
   - Review side-by-side metrics: Structured Validity (100%), Category Consistency, Evidence Grounding, and Latency delta.
7. **Step 7 — Enable Exemplar Injection**:
   - Toggle **Enabled** under Step 6 (AI Prompt Integration).
   - In subsequent review analyses (`FeedbackAnalyzer`), validated exemplars are injected into prompts with version-tagged tracking.
8. **Step 8 — Evidence-Backed Recommendations (`/actions`)**:
   - Inspect prioritized issues. Observe that recommendations clearly distinguish total mentions from unique reviews and cite verbatim customer feedback quotes.

