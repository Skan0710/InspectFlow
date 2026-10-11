# InsightFlow 🚀

> Intelligent observability and analytics platform scaffolded for the **Build Battle 2026** hackathon.

## Architecture & Tech Stack

```
InsightFlow/
├── client/                     # Frontend Application
│   ├── src/
│   │   ├── components/         # Reusable UI components (Navbar, Footer, etc.)
│   │   ├── pages/              # Routed pages (Home, Status)
│   │   ├── types/              # TypeScript types & API interfaces
│   │   ├── App.tsx             # Main routing & application layout
│   │   ├── index.css           # Tailwind CSS imports & base theme styles
│   │   └── main.tsx            # React application entry point
│   ├── .env.example            # Frontend environment variable template
│   ├── package.json            # React 19, Vite, Tailwind CSS, Lucide, Recharts, Framer Motion
│   ├── tsconfig.json           # TypeScript app & compiler configuration
│   └── vite.config.ts          # Vite plugin configuration & /api development proxy
│
├── server/                     # Backend API Server
│   ├── src/
│   │   └── index.ts            # Express server, CORS, error handling, /api/health
│   ├── .env.example            # Backend environment variable template
│   ├── package.json            # Node.js, Express, TypeScript, tsx, CORS, dotenv
│   └── tsconfig.json           # NodeNext ESM TypeScript configuration
│
├── .env.example                # Global environment variable documentation
├── .gitignore                  # Git ignore rules for dependencies, env, and build artifacts
└── package.json                # Root orchestration scripts with concurrently
```

### Frontend (`client/`)
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM (`react-router-dom`)
- **Icons**: Lucide React (`lucide-react`)
- **Charts & Telemetry**: Recharts (`recharts`)
- **Motion & Transitions**: Framer Motion (`framer-motion`)

### Backend (`server/`)
- **Runtime**: Node.js + Express
- **Language**: TypeScript (`NodeNext` ESM)
- **Dev Server**: `tsx watch` (fast zero-config TypeScript execution with hot reload)
- **Middleware**: `cors`, `dotenv`, JSON and URL-encoded body parsers

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **npm**: v9+ (tested on npm v11)

### 2. Installation
To install dependencies for root, client, and server at once:
```bash
npm run install:all
```

Or install individually:
```bash
npm install
npm install --prefix client
npm install --prefix server
```

### 3. Environment Variables
Copy the `.env.example` templates in both `client/` and `server/`:

```bash
# Server environment variables
cp server/.env.example server/.env

# Client environment variables
cp client/.env.example client/.env
```

Default configuration:
- `server/.env`:
  ```env
  PORT=5000
  NODE_ENV=development
  CLIENT_URL=http://localhost:5173
  ```
- `client/.env`:
  ```env
  VITE_API_URL=http://localhost:5000/api
  ```

### 4. Running the Development Servers

Run both the frontend and backend concurrently with a single command from the project root:
```bash
npm run dev
```

- **Frontend**: Accessible at [http://localhost:5173](http://localhost:5173)
- **Backend**: Accessible at [http://localhost:5000](http://localhost:5000)
- **Health Check Endpoint**: [http://localhost:5000/api/health](http://localhost:5000/api/health) (or proxied via frontend at [http://localhost:5173/api/health](http://localhost:5173/api/health))

### 5. Running Individually

```bash
# Run only backend
npm run dev:server

# Run only frontend
npm run dev:client
```

### 6. Production Builds

```bash
# Build both client and server
npm run build

# Build individual workspaces
npm run build:client
npm run build:server
```

---

## Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns server health status, uptime, timestamp, and environment |
