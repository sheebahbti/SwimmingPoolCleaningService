# Swimming Pool Cleaning Service

A full-stack scheduling and business management platform for a local pool cleaning company in Dallas, TX. Built to solve real operational problems: appointment booking, technician dispatch, maintenance tracking, photo documentation, invoicing, and automated customer communications.

---

## 🚀 Live Demo

**URL:** https://poolservice.onrender.com

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@example.com | password123 |
| **Technician** | bob@example.com | password123 |
| **Customer** | alice@example.com | password123 |

> **Note:** First load may take 30-60 seconds (free tier cold start).

---

## Why This Project

I built this to demonstrate end-to-end full-stack development — from system design through deployment — solving a real-world business problem. Every decision (tech stack, architecture, database schema) is documented with rationale.

### Architecture

```
Browser → Render (single service)
              ├── React SPA (static files via express.static)
              ├── Express API (/api/* routes)
              ├── node-cron (scheduled jobs)
              └── PostgreSQL (Render managed DB)
```

Single-service deployment: Express serves both the API and the built React frontend from one Render instance. No CORS, one URL, one deploy. See [SystemDesign.md](SystemDesign.md) for the full architecture document.

### Key Technical Decisions

| Decision | Choice | Why |
|---|---|---|
| Single service vs. separate frontend/backend | Single Render service | All users in Dallas — no CDN benefit. Simpler ops, no CORS. [Details](SystemDesign.md) |
| SQL vs. NoSQL | PostgreSQL | Relational data (users → pools → appointments → invoices). ACID needed for payments. [Details](TechnologyChoices.md) |
| Auth approach | JWT + bcrypt (no session store) | Stateless — no Redis needed at this scale. [Details](TechnologyChoices.md) |
| File storage | Local disk (dev) → Cloudflare R2 (prod) | R2 has $0 egress, free tier never expires. [Details](SystemDesign.md#4-object-storage--pool-photos) |

## Features

- **Role-based access** — Admin, Technician, and Customer dashboards with distinct permissions
- **Appointment scheduling** — FullCalendar-powered booking with technician assignment
- **Maintenance tracking** — Technicians log work with before/after photo uploads
- **Automated emails** — Appointment reminders, daily tech summaries, re-engagement campaigns (node-cron + Nodemailer)
- **Invoicing** — Auto-generated on job completion, PDF download (PDFKit), Stripe payment integration
- **Overdue detection** — Daily cron marks past-due invoices and sends payment reminders

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, FullCalendar, Axios |
| Backend | Node.js, Express 5, TypeScript, Passport.js + JWT |
| Database | PostgreSQL, Prisma ORM |
| Payments | Stripe (PaymentIntent flow) |
| Email | Nodemailer (Mailtrap for testing) |
| File Upload | Multer (local dev), Cloudflare R2 (production) |
| Testing | Jest + ts-jest + Supertest (backend), Vitest + React Testing Library (frontend) |
| Deployment | Render (single service), Nixpacks |

## Documentation

This project includes extensive design documentation:

| Document | What It Covers |
|---|---|
| [SystemDesign.md](SystemDesign.md) | Architecture, data flows, security, cost analysis, key concepts explained |
| [TechnologyChoices.md](TechnologyChoices.md) | Tech stack decisions with rationale, scaling strategy, NoSQL comparison |
| [DatabaseAndAPIDesign.md](DatabaseAndAPIDesign.md) | Schema design, ER relationships, REST API contract |
| [ImplementationPhases.md](ImplementationPhases.md) | 12-phase build plan, team structure, timeline estimates |
| [requirement.md](requirement.md) | Functional requirements by feature area |

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/sheebahbti/SwimmingPoolCleaningService.git
   ```

2. Navigate to the project directory:
   ```
   cd SwimmingPoolCleaningService
   ```

3. Install backend dependencies:
   ```
   cd backend
   npm install
   ```

4. Install frontend dependencies:
   ```
   cd ../frontend
   npm install
   ```

5. Set up the backend `.env` file (copy from `.env.example`):
   ```
   cd ../backend
   cp .env.example .env
   # Edit .env with your DATABASE_URL, JWT_SECRET, and SMTP settings
   ```

6. Run database migrations:
   ```
   npx prisma migrate dev
   ```

## Testing

The project includes comprehensive test suites for both backend and frontend.

### Backend Tests (Jest)

```bash
cd backend

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Coverage targets:** 80% branches, functions, lines, and statements.

### Frontend Tests (Vitest)

```bash
cd frontend

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Test structure:**
- `backend/src/__tests__/` — Controller unit tests, route integration tests
- `frontend/src/__tests__/` — Component tests, helper utilities

## Running the App

Start both servers in separate terminals:

```bash
# Terminal 1 — Backend (port 3000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | password123 |
| Technician | bob@example.com | password123 |
| Customer | alice@example.com | password123 |

### What each role can do

- **Customer** — Book appointments, manage pools, view service history, view/pay invoices
- **Technician** — View assigned jobs, start/complete jobs, upload before/after photos, log maintenance
- **Admin** — Manage all users, view all appointments, manage all pools, manage invoices

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── controllers/    # Route handlers (auth, pools, schedules, invoices, etc.)
│   │   ├── middleware/      # JWT authentication middleware
│   │   ├── routes/          # Express route definitions
│   │   └── lib/             # Shared services (email, PDF, Stripe, scheduler, Prisma)
│   └── prisma/              # Schema + migrations
├── frontend/
│   └── src/
│       ├── pages/           # React pages (Dashboard, Booking, Invoices, etc.)
│       ├── components/      # Layout, ProtectedRoute
│       ├── context/         # Auth context + types
│       └── lib/             # Axios API client
├── SystemDesign.md          # Architecture & design decisions
├── TechnologyChoices.md     # Tech stack rationale
├── ImplementationPhases.md  # Build phases & timeline
└── render.yaml             # Render deployment config
```

## Deployment

Deployed as a single Render service (Express serves both API + React static files).

```bash
# render.yaml handles everything:
# Build:  frontend (npm ci + build) → backend (npm ci + build)
# Start:  prisma migrate deploy → node dist/index.js
```

See [ImplementationPhases.md — Phase 11](ImplementationPhases.md#phase-11--deployment--go-live) for full deployment guide.

## Testing

### Testing Stack

| Tool | Purpose |
|---|---|
| **Jest** | Backend unit & integration tests |
| **Supertest** | API endpoint testing |
| **Vitest** | Frontend unit tests (faster with Vite) |
| **React Testing Library** | Component testing |
| **Playwright** | End-to-end browser tests |
| **MSW** | API mocking for frontend tests |

### Running Tests

```bash
# Backend tests
cd backend
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report

# Frontend tests
cd frontend
npm test              # Run all tests
npm run test:e2e      # Run Playwright E2E tests
```

### Test Structure

```
backend/
├── src/
│   ├── controllers/__tests__/   # Controller unit tests
│   ├── routes/__tests__/        # API integration tests
│   └── lib/__tests__/           # Service unit tests
└── jest.config.js

frontend/
├── src/
│   ├── pages/__tests__/         # Page component tests
│   ├── components/__tests__/    # Component tests
│   └── test/
│       ├── setup.ts             # Test setup (MSW, RTL)
│       └── mocks/               # MSW handlers
├── vitest.config.ts
└── e2e/                         # Playwright E2E tests
    └── *.spec.ts
```

### Code Coverage Targets

- **Statements:** 80%
- **Branches:** 75%
- **Functions:** 85%
- **Lines:** 80%

See [ImplementationPhases.md — Phase 12](ImplementationPhases.md#phase-12--testing--quality-assurance) for full testing strategy.

## License

MIT
