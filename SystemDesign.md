# Swimming Pool Cleaning Service — System Design & Technology Choices

This document combines the **architecture / system design** and the **technology choices & rationale** for the Swimming Pool Cleaning Service into a single reference.

---

## Target Market

- **Location:** Dallas, Texas
- **Scale:** Hundreds to low thousands of total users (local service business)
- **Peak concurrency:** ~20–200 simultaneous users (Monday morning booking surges, seasonal summer spikes)
- **User roles:** Admin, Technician, Customer

---

## How Discovery Answers Drove Our Technology Choices

Every technology decision below was driven by answers to the [discovery questions](SUMMARY.md#pre-build-discovery-questions--ask-before-writing-any-code). Here's the traceability:

| Discovery Answer | → | Technology Decision |
|---|---|---|
| Total users: hundreds, concurrent: ~20–200 | → | Single server, no load balancer, no Redis |
| Data is relational (Customers → Pools → Appointments) | → | PostgreSQL, not MongoDB or any NoSQL |
| Data size: a few GB, read-heavy but low volume | → | PostgreSQL on Render free tier, no caching layer |
| Location: Dallas only, single region | → | Render/Render, not AWS multi-region |
| Team knows TypeScript, React, Node.js | → | Node.js + Express, not ASP.NET Core or Django |
| Team: 6.5 people (PM, Dev Manager, 2 devs, UX, QA, part-time DevOps) = 4.75 FTE | → | Monolith, not microservices — simple stack a small team can own |
| Budget: $0–$25/month | → | Render/Render free tiers, not AWS/Azure |
| Auth: email/password, 3 roles | → | Passport.js + JWT, not Auth0 or Clerk |
| Payments: yes but can defer | → | Stripe in Phase 9, manual payments for MVP |
| Files: before/after pool photos | → | Cloudflare R2 (production), local disk (development) |
| Scheduling: core feature | → | FullCalendar (React) |
| Notifications: email + SMS | → | Nodemailer + Twilio |
| Rate limiting: yes but low traffic | → | express-rate-limit middleware, not Redis-based |
| Search: simple filters only | → | SQL WHERE clauses, not Elasticsearch |
| Offline: nice-to-have | → | PWA deferred to Phase 10 |

---

## Architecture Overview

```
┌─────────────┐   ┌─────────────┐
│ Web Browser │   │ Mobile PWA  │
│ (React SPA) │   │ (Technician)│
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │   Render       │  ← Single service: Express serves both
       │   (App Server)  │    API endpoints + React static files
       │                 │
       │  React SPA      │  ← Built frontend served via express.static
       │  (static files) │    SPA catch-all for client-side routing
       │                 │
       │  Express API    │  ← /api/* routes for backend logic
       │  (REST)         │    Authentication, business logic, validation
       │                 │
       │  ┌───────────┐  │
       │  │ node-cron │  │  ← Scheduled tasks running inside the server
       │  │ scheduler │  │    (reminders, daily summaries, re-engagement)
       │  └───────────┘  │
       └────────┬────────┘
                │
     ┌──────────┼──────────┬─────────────┬───────────┐
     │          │          │             │           │
┌────▼─────┐ ┌──▼───────┐ ┌▼─────────┐ ┌─▼──────┐ ┌──▼────┐
│PostgreSQL│ │Cloudflare│ │Nodemailer│ │ Twilio │ │Stripe │
│   (DB)   │ │    R2    │ │  (SMTP)  │ │ (SMS)  │ │(Pay)  │
│ Render  │ │ (photos)*│ │Mailtrap**│ │        │ │       │
└──────────┘ └──────────┘ └──────────┘ └────────┘ └───────┘

*  Local disk for development, Cloudflare R2 for production
** Mailtrap for testing (catches emails), SendGrid for production

Cron schedule:
  6:00 AM daily   → Technician daily schedule summary
  8:00 AM daily   → 24-hour appointment reminders to customers
  9:00 AM daily   → Mark overdue invoices + send payment reminders
  9:00 AM Mondays → Re-engagement emails to inactive customers
```

**Why this is enough:**
- ~20–200 concurrent users is well within a single server's capacity
- No load balancer needed — one app server handles this traffic easily
- No Redis needed — JWT is stateless (no server-side session storage), and express-rate-limit handles rate limiting in-memory
- No read replicas needed — PostgreSQL handles this read volume on a single instance
- No separate CDN needed — all users are in Dallas; Express serves static files fast enough for a local business

**Why a single service (not Render + Vercel)?**
- All users are in the Dallas metro area — a global CDN provides no meaningful benefit
- One deploy, one URL, one set of environment variables — simpler to manage and debug
- No CORS configuration needed — frontend and API are same-origin (`/api` calls, no cross-origin)
- One set of logs, one dashboard — when something breaks, you look in one place
- If the business expands beyond Dallas later, add Cloudflare (free) in front of Render for CDN caching

---

## Component Breakdown

### 1. App Server — Node.js + Express (Render)

- **What:** Single Node.js + Express server (TypeScript) that serves both the API and the React frontend
- **Stateless:** No session data on the server — JWT tokens carry auth state
- **Handles:** REST API (`/api/*` routes), business logic, authentication, input validation, and serving the built React SPA (static files via `express.static`)
- **SPA routing:** A catch-all route serves `index.html` for any non-API path, so client-side routing (React Router) works correctly
- **Why single server:** At ~20–200 concurrent users, one server has plenty of capacity. Add a second server only if response times degrade.
- **Cost:** Render free tier → ~$5–$10/month on Pro

### 2. PostgreSQL Database (Render)

- **What:** Single PostgreSQL instance on Render
- **ORM:** Prisma (TypeScript, type-safe queries, migrations)
- **Handles:** All reads and writes — customers, pools, appointments, service records, invoices
- **Backups:** Render automated daily snapshots
- **Cost:** Render free tier → ~$5–$10/month on Pro

### 3. Object Storage — Pool Photos

- **What:** Storage for before & after pool cleaning photos
- **Why:** Binary files (images) should NOT go in the database. Object storage is cheaper, faster, and scalable.
- **Production choice:** **Cloudflare R2** — $0 egress fees, free tier never expires, S3-compatible
- **Development:** Local disk storage (files saved to `backend/uploads/`)
- **Flow:** App server generates pre-signed upload URL → technician uploads directly to R2 → URL stored in database

**Storage options comparison:**

| Option | Free Tier | Egress Fees | Expires? | Best For |
|--------|-----------|-------------|----------|----------|
| **Cloudflare R2** ✓ | 10 GB | **$0** | Never | Our choice for production |
| **Local disk** ✓ | Unlimited | N/A | N/A | Development only |
| AWS S3 | 5 GB | $0.09/GB | 12 months | Enterprise, AWS ecosystem |
| Azure Blob Storage | 5 GB | $0.087/GB | 12 months | Azure ecosystem |
| Google Cloud Storage | 5 GB | $0.12/GB | 90 days | GCP ecosystem |

**Why R2 over S3/Azure:** Zero egress fees (viewing images is free — AWS/Azure charge ~$0.09/GB per download), no credit card required, free tier doesn't expire, S3-compatible API (same code works with AWS S3 if you switch later), and 99.999999999% durability (same as AWS S3).

**Development strategy:**
1. **Local disk first** — Files saved to `backend/uploads/`, zero setup
2. **Test end-to-end** — Verify upload flow works before adding cloud complexity
3. **Switch to R2** — Only change storage destination, upload logic stays the same

**npm packages:**

```bash
npm install @aws-sdk/client-s3  # Same SDK works for R2 (S3-compatible)
npm install multer              # For handling file uploads in Express
```

### 4. External Services

| Service | Purpose | Cost |
|---|---|---|
| **Stripe** | Payment processing for invoices | 2.9% + $0.30 per transaction |
| **Twilio** | SMS appointment reminders | ~$0.0079/SMS |
| **Nodemailer** | Email confirmations (via Mailtrap for testing, SendGrid for production) | Free (Mailtrap free tier: 100/month) |

---

## Technology Choices & Rationale

### Database: PostgreSQL (Only)

**Why PostgreSQL?**

- **Relational data model** — Customers → Pools → Appointments → Maintenance Records → Technicians → Invoices all have clear, structured relationships with foreign keys and constraints.
- **ACID transactions** — Booking an appointment, assigning a technician, and sending confirmation must be atomic. PostgreSQL guarantees this.
- **Prisma ORM** — Auto-generated TypeScript types, type-safe queries, and painless migrations. Perfect for a TypeScript stack.
- **Managed hosting** — Render/Render offer managed PostgreSQL with automated backups, free tiers, and zero-config deploys.

**NoSQL Database Types (Mnemonic: "Renu Moti Can Never Dance Choreography")**

| Mnemonic | Database | NoSQL Type | Use When |
|---|---|---|---|
| Renu | Redis | Key-Value | Real-time caching, sessions, leaderboards — need O(1) lookups |
| Moti | MongoDB | Document | Flexible schemas, nested data, user profiles, product catalogs |
| Can | Cassandra | Column-Family | High write throughput, time-series, IoT, event logs |
| Never | Neo4j | Graph | Relationships matter — social networks, fraud detection, recommendations |
| Dance | DynamoDB | Key-Value + Document | Serverless AWS apps, simple access patterns, auto-scaling |
| Choreography | Cosmos DB | All Types | Multi-model needs, global distribution, Azure ecosystem |

**Why NOT a NoSQL Database for This App?**

| NoSQL DB | Type | Why We Don't Need It |
|---|---|---|
| **Redis** (Key-Value) | Cache/Sessions | JWT is stateless — the token carries session data, no server-side session store needed. Our user base (admins + technicians + customers) is small enough that PostgreSQL handles all reads without a caching layer. |
| **MongoDB** (Document) | Flexible schemas | Our data is highly relational. Customers have pools, pools have appointments, appointments have maintenance records. This is exactly what SQL was built for. |
| **Cassandra** (Column-Family) | High write throughput | We're not an IoT platform or event-logging system. A pool cleaning service has modest write volume. |
| **Neo4j** (Graph) | Relationships/traversal | No social network, fraud detection, or recommendation engine. Our relationships are simple parent-child, not complex graphs. |
| **DynamoDB** (Key-Value + Document) | Serverless AWS | We're not in an AWS serverless architecture. PostgreSQL on Render is simpler and cheaper. |
| **Cosmos DB** (Multi-model) | Global distribution | We serve Dallas, Texas — not a globally distributed app. No need for Azure's multi-region replication. |

**When Would We Add Redis?**

Only if the app scales to thousands of concurrent users and we need:
- Caching frequently-read time slots to reduce DB load
- Rate limiting to prevent booking spam
- Shared state across multiple horizontally-scaled servers

That's a future scaling concern, not an MVP concern.

### Backend: Node.js + Express (TypeScript)

**Why Node.js over ASP.NET Core?**

1. **Scope** — This is a scheduling/CRUD app, not an enterprise system. Express keeps things lean.
2. **One language** — TypeScript end-to-end (frontend + backend) means shared validation schemas, shared types, less mental overhead.
3. **Ecosystem** — npm has purpose-built packages for every feature: scheduling, PDF invoices, email, payments.
4. **Deployment cost** — Node.js apps deploy cheaply on Render/Render/Vercel. Azure App Service is more expensive for what we need.
5. **Speed of development** — Faster iteration for a small team building an MVP.

**Backend npm Packages — Production Dependencies**

| Package | What It Does |
|---|---|
| `express` | Web server framework — handles routing, middleware, request/response |
| `prisma` | Database toolkit — runs migrations, generates the client from `schema.prisma` |
| `@prisma/client` | Auto-generated, type-safe query builder for PostgreSQL |
| `cors` | Middleware to allow the React frontend to call the API from a different origin |
| `dotenv` | Loads `.env` file so secrets (DB URL, JWT secret) stay out of code |
| `bcrypt` | Hashes passwords before storing them — never store plain text |
| `jsonwebtoken` | Creates and verifies JWT tokens for stateless authentication |
| `passport` | Authentication middleware framework — pluggable strategies |
| `passport-local` | Strategy for email/password login |
| `passport-jwt` | Strategy for protecting routes with JWT tokens |

**Backend npm Packages — Dev Dependencies**

| Package | What It Does |
|---|---|
| `typescript` | TypeScript compiler — compiles `.ts` files to JavaScript |
| `ts-node` | Runs TypeScript files directly without a separate compile step |
| `nodemon` | Auto-restarts the server when files change during development |
| `@types/node` | TypeScript type definitions for Node.js built-in modules |
| `@types/express` | TypeScript type definitions for Express |
| `@types/cors` | TypeScript type definitions for cors |
| `@types/bcrypt` | TypeScript type definitions for bcrypt |
| `@types/jsonwebtoken` | TypeScript type definitions for jsonwebtoken |
| `@types/passport` | TypeScript type definitions for Passport |
| `@types/passport-local` | TypeScript type definitions for passport-local |
| `@types/passport-jwt` | TypeScript type definitions for passport-jwt |

**Install Commands**

```bash
# Production dependencies
npm install express prisma @prisma/client cors dotenv bcrypt jsonwebtoken passport passport-jwt passport-local

# Dev dependencies
npm install -D typescript @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken @types/passport @types/passport-jwt @types/passport-local ts-node nodemon
```

### Frontend: React + TypeScript + Tailwind CSS

- **React** — Component-based architecture for reusable forms, tables, and scheduling views.
- **TypeScript** — Catches API contract mismatches at compile time, not runtime.
- **Tailwind CSS** — Utility-first CSS speeds up UI development without writing custom stylesheets.
- **FullCalendar (React)** — Purpose-built for scheduling; drag-and-drop rescheduling out of the box.

### Authentication: Passport.js + JWT

- **Stateless** — JWT tokens carry user identity and roles. The server just verifies the signature — no session store, no Redis, no database lookup on every request.
- **Lightweight** — Well-documented, no vendor lock-in.
- **Right-sized** — For a small user base (admins + technicians + customers), this is the right level of complexity. No need for Auth0 or Clerk at this scale.

### Notifications: Nodemailer + Twilio

- **Nodemailer** — Free for SMTP-based email. Use **Mailtrap** for testing (catches emails so you verify before customers see them), **SendGrid** for production deliverability.
- **Twilio** — Industry-standard SMS API for appointment reminders. Excellent Node.js SDK.

### Payments: Stripe

- Industry standard for online payments
- Excellent sandbox for development/testing
- Webhooks for real-time payment confirmation
- Handles PCI compliance so we don't have to
- Great Node.js SDK

---

## Data Flow — Booking an Appointment

```
Customer → App Server (Render)
                │
                ├─→ Serves React SPA (static files, first load only)
                ├─→ POST /api/bookings
                │     ├─→ PostgreSQL (check available slots)
                │     ├─→ PostgreSQL (write booking record)
                │     ├─→ Nodemailer (confirmation email)
                │     └─→ Twilio (SMS reminder queued)
                └─→ JSON response → React updates UI
```

---

## Data Flow — Technician Uploading Photos

### Development (Local Storage)

```
Technician → App Server (Render)
                  │
                  ├─→ multer middleware (parses multipart/form-data)
                  ├─→ Saves file to backend/uploads/ folder
                  ├─→ Returns URL: /uploads/abc123.jpg
                  │
                  ├─→ POST /api/maintenance (with photo URLs)
                  └─→ PostgreSQL (store photo URL in MaintenanceRecord)

Viewing photos:
Browser → GET /uploads/abc123.jpg → express.static serves file from disk
```

### Production (Cloudflare R2)

```
Technician → App Server (Render)
                  │
                  ├─→ Generate pre-signed R2 upload URL
                  │
Technician ───────────────→ Cloudflare R2 (direct upload, app server not involved)
                  │
                  ├─→ POST /api/maintenance (with R2 URLs)
                  └─→ PostgreSQL (store R2 URL in MaintenanceRecord)

Viewing photos:
Browser → GET https://r2.poolservice.com/abc123.jpg → R2 CDN serves file
```

---

## Security Architecture

- **SSL/TLS everywhere** — HTTPS enforced by Render (auto-provisioned certificates)
- **JWT tokens** — Short-lived access tokens (15 min) + refresh tokens (7 days), stored in httpOnly cookies
- **Input validation** — Zod schemas on every API endpoint
- **Rate limiting** — express-rate-limit middleware (in-memory, per-IP)
- **Pre-signed URLs** — Photos uploaded directly to S3/R2, never passing through app server
- **Database** — Parameterized queries via Prisma (SQL injection prevention)
- **Secrets** — Environment variables managed by Render, never committed to repo
- **CORS** — Not needed (frontend and API are same-origin); configured as fallback for development

---

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Testing Pyramid                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                         ┌─────────┐                             │
│                         │   E2E   │ ← Playwright                │
│                         │  Tests  │   (critical user flows)     │
│                         └────┬────┘                             │
│                     ┌────────┴────────┐                         │
│                     │   Integration   │ ← Supertest + Jest      │
│                     │     Tests       │   (API + database)      │
│                     └────────┬────────┘                         │
│         ┌────────────────────┴────────────────────┐             │
│         │              Unit Tests                 │ ← Jest/Vitest│
│         │    (functions, components, utils)       │   + RTL     │
│         └─────────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Jest (Backend) + Vitest (Frontend) + React Testing Library

Testing is critical for catching regressions and building confidence before deployments. We chose tools that integrate well with our TypeScript/React stack.

| Tool | Purpose | Why This Tool |
|---|---|---|
| **Jest** | Backend unit + integration tests | De facto standard for JS/TS, fast parallel execution, built-in mocking, excellent TypeScript support via ts-jest |
| **ts-jest** | Jest TypeScript transformer | Native TypeScript support without precompilation, type checking during tests |
| **Supertest** | API integration tests | HTTP assertions for Express, works seamlessly with Jest, test without running server |
| **Vitest** | Frontend unit tests | Faster than Jest for Vite projects, compatible Jest API, native ESM support, integrated coverage |
| **React Testing Library** | Component tests | Tests user behavior not implementation details, encourages accessible code, maintained by Testing Library team |
| **MSW (Mock Service Worker)** | API mocking | Intercepts network requests, same mocks work in browser and Node, no server changes needed |
| **Faker.js** | Test data generation | Realistic fake data for users, emails, addresses, dates — better than hardcoded strings |
| **Playwright** | End-to-end browser tests | Cross-browser E2E for critical user flows (Chrome, Firefox, Safari) |

**Why Jest for Backend, Vitest for Frontend?**

| Criteria | Jest (Backend) | Vitest (Frontend) |
|---|---|---|
| **Bundle format** | CommonJS native | ESM native (matches Vite) |
| **Speed** | Fast for Node.js code | Optimized for Vite projects |
| **Configuration** | Mature ecosystem, ts-jest | Zero-config with Vite |
| **Coverage** | c8/Istanbul integration | Built-in v8 coverage |
| **Watch mode** | Excellent | Excellent + HMR-like speed |

Using the right tool for each environment: Jest handles backend (CommonJS, Prisma mocks, API routes), while Vitest handles frontend (ESM, React components, DOM testing).

### Test Types & Coverage

| Test Type | What It Tests | Tools | Target Coverage |
|---|---|---|---|
| **Unit Tests** | Individual functions, utilities, business logic | Jest (backend), Vitest (frontend) | 80% statements |
| **Component Tests** | React components in isolation | React Testing Library | Key user interactions |
| **Integration Tests** | API endpoints with real database | Supertest + Jest | All API routes |
| **E2E Tests** | Complete user workflows in browser | Playwright | 5-10 critical paths |

### Code Coverage Targets

| Environment | Branches | Functions | Lines | Statements |
|---|---|---|---|---|
| Backend (Jest) | 80% | 80% | 80% | 80% |
| Frontend (Vitest) | 70% | 70% | 70% | 70% |

### Testing npm Packages

```bash
# Backend testing
npm install -D jest @types/jest ts-jest supertest @types/supertest @faker-js/faker

# Frontend testing
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Test Data Strategy

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Development DB  │    │    Test DB      │    │  CI/CD Test DB  │
│ (Local Postgres)│    │ (Separate local)│    │ (GitHub Actions)│
│                 │    │                 │    │                 │
│ Persistent data │    │ Wiped per suite │    │ Fresh per run   │
│ Manual testing  │    │ npm test        │    │ Isolated        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

- **Seed script** creates test users (Admin, Technician, Customer) with known passwords
- **Faker.js** generates realistic test data (names, emails, addresses)
- **Database transactions** with rollback for fast, isolated integration tests

### CI/CD Pipeline

```
Git Push → GitHub Actions
               │
               ├──→ Lint (ESLint, Prettier)
               │
               ├──→ Backend Tests
               │    ├── Unit tests (Jest)
               │    └── Integration tests (Supertest)
               │
               ├──→ Frontend Tests
               │    ├── Unit tests (Vitest)
               │    └── Component tests (RTL)
               │
               ├──→ E2E Tests (Playwright)
               │    └── Chrome, Firefox, Safari
               │
               └──→ Deploy to Render (if all pass)
```

### What We Test vs. What We Skip

| ✅ Test | ❌ Skip |
|---|---|
| Business logic (invoice calculation, permissions) | Prisma-generated code |
| API contracts (request/response shapes) | Third-party SDK internals |
| User interactions (forms, navigation) | CSS styling (visual regression for critical UI) |
| Error handling (invalid inputs, failures) | Framework boilerplate |
| Authentication & authorization flows | Obvious getters/setters |

---

## Deployment: Render (Single Service)

| Component | Platform | Why |
|---|---|---|
| Express backend + React frontend | Render | Single service — Express serves both API and built React static files. One deploy, one URL, no CORS. |
| PostgreSQL | Render | Managed database with automated backups, same platform as app server (low latency) |

**Why a single Render service (not Render + Vercel)?**
- All users are in Dallas — a global CDN provides no meaningful benefit for a local business
- One deploy, one URL, one set of environment variables — simpler to manage and debug
- No CORS configuration — frontend and API are same-origin
- If expanding beyond Dallas later, add Cloudflare (free) in front of Render for CDN caching

**Why NOT Azure/AWS?**
- **Cost** — Overkill for a local service business app. Render/Render free tiers cover MVP.
- **Complexity** — No need for VPCs, IAM roles, or multi-region infrastructure for a Dallas-only service.
- **Speed** — Zero-config GitHub deploys vs. configuring Azure App Service or ECS.

---

## Availability & Reliability

- **Uptime target:** 99.9% (< 9 hours downtime/year)
- **Health checks:** Render monitors `/api/health` endpoint
- **Database backups:** Render automated daily snapshots, 7-day retention
- **Monitoring:** Sentry (error tracking), Render metrics (CPU, memory, response times)
- **Logging:** Structured JSON logs via Pino or Winston

---

## Estimated Infrastructure Cost (Current Scale)

| Component | Service | Est. Monthly Cost |
|---|---|---|
| App Server + Frontend | Render (free → Pro) | $0–$10 |
| PostgreSQL | Render (free → Pro) | $0–$10 |
| Object Storage | Cloudflare R2 (free tier) | $0 |
| Domain + SSL | Cloudflare (free) / Render | $0–$12/year |
| **Total** | | **$0–$25/month** |

> **When to upgrade:** If response times exceed 500ms consistently or Render free tier limits are hit, move to Render Pro (~$20/month total for server + DB). See [Scaling: What You Need at Each User Level](#scaling-what-you-need-at-each-user-level) for what to add at each growth stage.

---

## Single-Region vs. Multi-Region — What Technology to Use

| Layer | Single Region (Our App — Dallas) | Multi-Region (National/Global) |
|---|---|---|
| **Database** | PostgreSQL (🔵 **single instance on Render**) | PostgreSQL + 🔴 **read replicas per region**, OR 🔴 **CockroachDB (distributed SQL)**, OR 🔴 **Cosmos DB** |
| **Caching** | 🔵 **None needed** | 🔴 **Redis required** (🔴 **edge cache per region** for low-latency reads) |
| **Auth/Sessions** | JWT (stateless — 🔵 **no session store**) | JWT still works (🟢 **no change needed**) |
| **Backend** | 🔵 **Single Node.js instance** on Render/Render | 🔴 **Multiple instances per region** behind a 🔴 **global load balancer** (AWS ALB, Cloudflare) |
| **Frontend/CDN** | 🔵 **None needed** — Express serves static files, all users in Dallas | 🔴 **Add Cloudflare** to cache static assets globally (only when expanding beyond Dallas) |
| **DNS** | 🔵 **Simple DNS** | 🔴 **Geo-DNS routing** (Route 53, Cloudflare) to route users to nearest region |
| **Hosting** | Render/Render (🔵 **simple, cheap**) | 🔴 **AWS / Azure / GCP** (🔴 **multi-region infrastructure required**) |
| **Notifications** | Nodemailer + Twilio | 🟢 **No change** (API calls are region-agnostic) |
| **Payments** | Stripe | Stripe still works, 🔴 **add multi-currency support** |
| **Cost** | 🔵 **~$0–$25/month** (free tiers) | 🔴 **~$500–$2,000+/month** (multi-region compute + distributed DB) |
| **Complexity** | 🔵 **Low** — single deploy, single DB | 🔴 **High** — geo-routing, replication lag, regional failover |
| **When to use** | Users in 🔵 **1 city/region** | Users across 🔴 **country or worldwide** |

---

## Scaling: What You Need at Each User Level

| Concurrent Users | App Servers | Database | Caching | Load Balancer | Hosting | Est. Monthly Cost |
|---|---|---|---|---|---|---|
| **20–200** (Our app — local Dallas business) | 1 Node.js instance | PostgreSQL (single) | None needed | None needed | Render/Render | ~$0–$25 |
| **200–1,000** | 1 Node.js instance | PostgreSQL (single) + connection pooling (Prisma) | None needed | None needed | Render/Render | ~$25–$50 |
| **1,000–5,000** | 1–2 instances | PostgreSQL + read replica | Redis (cache hot reads) | Nginx or Render built-in | Render Pro or AWS | ~$50–$150 |
| **5,000–10,000** | 2–3 instances | PostgreSQL primary + 1 read replica | Redis (cache + rate limiting) | AWS ALB | AWS | ~$150–$300 |
| **10,000–50,000** | 3–5 instances (auto-scaling) | PostgreSQL primary + 2 read replicas | Redis cluster | AWS ALB | AWS | ~$300–$500 |
| **50,000–1,000,000** | 5–10 instances (auto-scaling) | PostgreSQL + PgBouncer + sharding | Redis cluster + CDN caching | AWS ALB | AWS multi-AZ | ~$500–$2,000+ |

### Key Takeaways

- **Our app sits in the first row.** A local pool cleaning service with ~10–50 technicians and hundreds of customers will never exceed 200 concurrent users.
- **PostgreSQL alone handles up to ~1,000 concurrent users** comfortably with Prisma's connection pooling.
- **Redis becomes necessary at ~1,000+ concurrent users** when repeated reads (time slots, schedules) start bottlenecking the database.
- **A load balancer becomes necessary at ~5,000+ concurrent users** when a single server can't handle the request volume.
- **You don't need to build for 1M users on day one.** Start simple, add infrastructure only when real traffic demands it.

---

## Key Concepts Explained

### What is a React SPA (Single Page Application)?

Instead of loading a new HTML page every time you click a link, a React SPA loads **one HTML page once**, then JavaScript handles all navigation and content updates without full page reloads.

- Browser downloads the React app (JS/CSS bundle) once from the Render server
- User clicks "Appointments" → React swaps content on screen instantly (no server round-trip for a new page)
- Only **data** is fetched from the API server (JSON) — not entire HTML pages
- Page transitions feel instant (no white-screen flicker)
- Works well for dashboards — Admin, Technician, and Customer views all live in one app

### What is a PWA (Progressive Web App)?

A regular website that **looks and feels like a native mobile app** — without publishing to the App Store or Google Play.

- **Installable:** User taps "Add to Home Screen" → gets an app icon, opens full-screen (no browser bar)
- **Offline-capable:** A service worker caches pages so the app works without internet (useful for technicians with spotty signal)
- **Push notifications:** Can send alerts like a native app
- **One codebase:** Same React app serves both desktop and mobile — no separate iOS/Android code
- **Instant updates:** Deploy once, all users get it immediately — no App Store approval

For this app: technicians use the PWA on their phones to view schedules, upload pool photos, and mark jobs complete (Phase 10).

### What is a CDN (Content Delivery Network)?

A network of servers spread across the world that deliver your files from the location closest to the user.

**For this app (single region, Dallas):** We don't use a separate CDN. All users are in the Dallas metro area, so serving static files directly from Render is fast enough. The React SPA is ~500KB — it loads in under a second.

**If we need a CDN later:** Put Cloudflare (free tier) in front of the Render URL. This gives global edge caching, DDoS protection, and free SSL — takes about 5 minutes to set up. Worth doing if the business expands beyond Dallas.

**CDN alternatives:** Cloudflare (free), AWS CloudFront, Fastly

### What is an App Server?

The computer that runs your backend code. When a user books an appointment, their browser sends a request to this server, which processes it, saves to the database, and sends back a response.

- Receives API calls from the React frontend (e.g. `POST /api/appointments`)
- Validates input, checks authentication, runs business logic
- Reads/writes to PostgreSQL via Prisma
- Sends emails (Nodemailer) and SMS (Twilio)
- Returns JSON responses to the frontend

### What is Render?

A cloud platform that runs your code — like renting a computer in the cloud. You push code to GitHub → Render auto-deploys it and gives your server a public URL.

**We use Render for three things:**

| What | Why |
|---|---|
| App Server (Node.js + Express) | Runs backend API code |
| React Frontend (static files) | Served by Express via `express.static` — same server, same URL |
| PostgreSQL Database | Stores all data (customers, pools, appointments, invoices) |

**Why everything on Render:** Same platform = one dashboard, one bill, one URL, one deploy, and low latency between server and database (~1-2ms since they're in the same data center). No CORS configuration needed since frontend and API share the same origin.

**Alternatives:** Render, Fly.io, Heroku (no free tier), AWS EC2, DigitalOcean

### How One Server Handles Both Frontend and API

Our Express server does double duty:

| Request | What Happens |
|---|---|
| `GET /` (or any non-API path) | Express serves the built React SPA (`frontend/dist/index.html`) via `express.static` |
| `GET /api/pools` | Express routes to the API controller, queries PostgreSQL, returns JSON |
| `POST /api/bookings` | Express validates input, writes to DB, sends email, returns JSON |
| `GET /assets/main.js` | Express serves the static JS bundle from `frontend/dist/assets/` |

**How it works:** The build step compiles the React app into static files (`frontend/dist/`). Express serves these files and uses a catch-all route so that React Router handles all client-side navigation. API routes (`/api/*`) are registered first and take priority.

**Analogy:** One restaurant where the front counter (static files) and the kitchen (API) are in the same building — no delivery driver needed between them.

### Where Everything Is Hosted — Summary

| Component | Hosted On | Why There |
|---|---|---|
| React frontend + Express API | **Render** (single service) | One deploy, one URL, no CORS — simplest setup for a local business |
| PostgreSQL database | **Render** | Co-located with app server for low latency |
| Pool photos (dev) | **Local disk** | Zero setup, testing file upload logic |
| Pool photos (prod) | **Cloudflare R2** | $0 egress fees, free tier never expires |
| Email delivery | **Mailtrap** (testing) / **SendGrid** (production) | Test emails safely before going live |
| SMS delivery | **Twilio** | SMS delivery service |
| Payment processing | **Stripe** | PCI-compliant payment processor |
| CDN (optional, future) | **Cloudflare** (free tier) | Add in front of Render if expanding beyond Dallas |

---

## Technology Summary

| Concern | Choice | Core Reason |
|---|---|---|
| Data storage | PostgreSQL only | Relational data, small scale, ACID needed |
| Caching | None (for now) | JWT is stateless, user base is small |
| Backend | Node.js + Express | One language (TS), fast development, cheap hosting |
| Frontend | React + Tailwind | Component reuse, type safety, rapid UI |
| Auth | Passport.js + JWT | Stateless, simple, no external dependencies |
| Hosting | Render (single service) | Cheap, simple, GitHub-integrated |
