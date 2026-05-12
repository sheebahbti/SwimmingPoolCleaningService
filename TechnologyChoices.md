# Swimming Pool Cleaning Service — Technology Choices & Rationale

---

## How Discovery Answers Drove Our Technology Choices

Every technology decision below was driven by answers to the [Ask Questions](AskQuestions.md). Here's the traceability:

| Discovery Answer | → | Technology Decision |
|---|---|---|
| Total users: hundreds, concurrent: ~20–200 | → | Single server, no load balancer, no Redis |
| Data is relational (Customers → Pools → Appointments) | → | PostgreSQL, not MongoDB or any NoSQL |
| Data size: a few GB, read-heavy but low volume | → | PostgreSQL on Railway free tier, no caching layer |
| Location: Dallas only, single region | → | Railway/Render, not AWS multi-region |
| Team knows TypeScript, React, Node.js | → | Node.js + Express, not ASP.NET Core or Django |
| Team: 6.5 people (PM, Dev Manager, 2 devs, UX, QA, part-time DevOps) = 4.75 FTE | → | Monolith, not microservices — simple stack a small team can own |
| Budget: $0–$25/month | → | Railway/Render free tiers, not AWS/Azure |
| Auth: email/password, 3 roles | → | Passport.js + JWT, not Auth0 or Clerk |
| Payments: yes but can defer | → | Stripe in Phase 9, manual payments for MVP |
| Files: before/after pool photos | → | S3 / Cloudflare R2 for object storage |
| Scheduling: core feature | → | FullCalendar (React) |
| Notifications: email + SMS | → | Nodemailer + Twilio |
| Rate limiting: yes but low traffic | → | express-rate-limit middleware, not Redis-based |
| Search: simple filters only | → | SQL WHERE clauses, not Elasticsearch |
| Offline: nice-to-have | → | PWA deferred to Phase 10 |

---

## Database: PostgreSQL (Only)

### Why PostgreSQL?

- **Relational data model** — Customers → Pools → Appointments → Maintenance Records → Technicians → Invoices all have clear, structured relationships with foreign keys and constraints.
- **ACID transactions** — Booking an appointment, assigning a technician, and sending confirmation must be atomic. PostgreSQL guarantees this.
- **Prisma ORM** — Auto-generated TypeScript types, type-safe queries, and painless migrations. Perfect for a TypeScript stack.
- **Managed hosting** — Railway/Render offer managed PostgreSQL with automated backups, free tiers, and zero-config deploys.

### NoSQL Database Types (Mnemonic: "Renu Moti Can Never Dance Choreography")

| Mnemonic | Database | NoSQL Type | Use When |
|---|---|---|---|
| Renu | Redis | Key-Value | Real-time caching, sessions, leaderboards — need O(1) lookups |
| Moti | MongoDB | Document | Flexible schemas, nested data, user profiles, product catalogs |
| Can | Cassandra | Column-Family | High write throughput, time-series, IoT, event logs |
| Never | Neo4j | Graph | Relationships matter — social networks, fraud detection, recommendations |
| Dance | DynamoDB | Key-Value + Document | Serverless AWS apps, simple access patterns, auto-scaling |
| Choreography | Cosmos DB | All Types | Multi-model needs, global distribution, Azure ecosystem |

### Why NOT a NoSQL Database for This App?

| NoSQL DB | Type | Why We Don't Need It |
|---|---|---|
| **Redis** (Key-Value) | Cache/Sessions | JWT is stateless — the token carries session data, no server-side session store needed. Our user base (admins + technicians + customers) is small enough that PostgreSQL handles all reads without a caching layer. |
| **MongoDB** (Document) | Flexible schemas | Our data is highly relational. Customers have pools, pools have appointments, appointments have maintenance records. This is exactly what SQL was built for. |
| **Cassandra** (Column-Family) | High write throughput | We're not an IoT platform or event-logging system. A pool cleaning service has modest write volume. |
| **Neo4j** (Graph) | Relationships/traversal | No social network, fraud detection, or recommendation engine. Our relationships are simple parent-child, not complex graphs. |
| **DynamoDB** (Key-Value + Document) | Serverless AWS | We're not in an AWS serverless architecture. PostgreSQL on Railway is simpler and cheaper. |
| **Cosmos DB** (Multi-model) | Global distribution | We serve Dallas, Texas — not a globally distributed app. No need for Azure's multi-region replication. |

### When Would We Add Redis?

Only if the app scales to thousands of concurrent users and we need:
- Caching frequently-read time slots to reduce DB load
- Rate limiting to prevent booking spam
- Shared state across multiple horizontally-scaled servers

That's a future scaling concern, not an MVP concern.

---

## Backend: Node.js + Express (TypeScript)

### Why Node.js over ASP.NET Core?

1. **Scope** — This is a scheduling/CRUD app, not an enterprise system. Express keeps things lean.
2. **One language** — TypeScript end-to-end (frontend + backend) means shared validation schemas, shared types, less mental overhead.
3. **Ecosystem** — npm has purpose-built packages for every feature: scheduling, PDF invoices, email, payments.
4. **Deployment cost** — Node.js apps deploy cheaply on Railway/Render/Vercel. Azure App Service is more expensive for what we need.
5. **Speed of development** — Faster iteration for a small team building an MVP.

### Backend npm Packages

#### Production Dependencies

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

#### Dev Dependencies

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

#### Install Commands

```bash
# Production dependencies
npm install express prisma @prisma/client cors dotenv bcrypt jsonwebtoken passport passport-jwt passport-local

# Dev dependencies
npm install -D typescript @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken @types/passport @types/passport-jwt @types/passport-local ts-node nodemon
```

---

## Frontend: React + TypeScript + Tailwind CSS

- **React** — Component-based architecture for reusable forms, tables, and scheduling views.
- **TypeScript** — Catches API contract mismatches at compile time, not runtime.
- **Tailwind CSS** — Utility-first CSS speeds up UI development without writing custom stylesheets.
- **FullCalendar (React)** — Purpose-built for scheduling; drag-and-drop rescheduling out of the box.

---

## Authentication: Passport.js + JWT

- **Stateless** — JWT tokens carry user identity and roles. The server just verifies the signature — no session store, no Redis, no database lookup on every request.
- **Lightweight** — Well-documented, no vendor lock-in.
- **Right-sized** — For a small user base (admins + technicians + customers), this is the right level of complexity. No need for Auth0 or Clerk at this scale.

---

## Notifications: Nodemailer + Twilio

- **Nodemailer** — Free for SMTP-based email. Pair with SendGrid for production deliverability.
- **Twilio** — Industry-standard SMS API for appointment reminders. Excellent Node.js SDK.

---

## Payments: Stripe

- Industry standard for online payments
- Excellent sandbox for development/testing
- Webhooks for real-time payment confirmation
- Handles PCI compliance so we don't have to
- Great Node.js SDK

---

## Deployment: Vercel + Railway/Render

| Component | Platform | Why |
|---|---|---|
| React frontend | Vercel | First-class React/Next.js support, global CDN, instant deploys from GitHub |
| Express backend | Railway or Render | Managed Node.js hosting, zero-config deploys, free tier |
| PostgreSQL | Railway or Render | Managed database with automated backups, included in same platform as backend |

### Why NOT Azure/AWS?

- **Cost** — Overkill for a local service business app. Railway/Render free tiers cover MVP.
- **Complexity** — No need for VPCs, IAM roles, or multi-region infrastructure for a Dallas-only service.
- **Speed** — Zero-config GitHub deploys vs. configuring Azure App Service or ECS.

---

## Single-Region vs. Multi-Region Use case - What technolgy to use

| Layer | Single Region (Our App — Dallas) | Multi-Region (National/Global) |
|---|---|---|
| **Database** | PostgreSQL (single instance on Railway) | PostgreSQL + read replicas per region, OR CockroachDB (distributed SQL), OR Cosmos DB |
| **Caching** | None needed | Redis required (edge cache per region for low-latency reads) |
| **Auth/Sessions** | JWT (stateless — no session store) | JWT still works (no change needed) |
| **Backend** | Single Node.js instance on Railway/Render | Multiple instances per region behind a global load balancer (AWS ALB, Cloudflare) |
| **Frontend/CDN** | Vercel Edge (already global) | No change — Vercel/Cloudflare already serves static assets globally |
| **DNS** | Simple DNS | Geo-DNS routing (Route 53, Cloudflare) to route users to nearest region |
| **Hosting** | Railway/Render (simple, cheap) | AWS / Azure / GCP (multi-region infrastructure required) |
| **Notifications** | Nodemailer + Twilio | No change (API calls are region-agnostic) |
| **Payments** | Stripe | Stripe still works, add multi-currency support |
| **Cost** | ~$0–$25/month (free tiers) | ~$500–$2,000+/month (multi-region compute + distributed DB) |
| **Complexity** | Low — single deploy, single DB | High — geo-routing, replication lag, regional failover |
| **When to use** | Users in 1 city/region | Users across country or worldwide |

---

## Scaling: What You Need at Each User Level

| Concurrent Users | App Servers | Database | Caching | Load Balancer | Hosting | Est. Monthly Cost |
|---|---|---|---|---|---|---|
| **20–200** (Our app — local Dallas business) | 1 Node.js instance | PostgreSQL (single) | None needed | None needed | Railway/Render | ~$0–$25 |
| **200–1,000** | 1 Node.js instance | PostgreSQL (single) + connection pooling (Prisma) | None needed | None needed | Railway/Render | ~$25–$50 |
| **1,000–5,000** | 1–2 instances | PostgreSQL + read replica | Redis (cache hot reads) | Nginx or Railway built-in | Railway Pro or AWS | ~$50–$150 |
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

## Summary

| Concern | Choice | Core Reason |
|---|---|---|
| Data storage | PostgreSQL only | Relational data, small scale, ACID needed |
| Caching | None (for now) | JWT is stateless, user base is small |
| Backend | Node.js + Express | One language (TS), fast development, cheap hosting |
| Frontend | React + Tailwind | Component reuse, type safety, rapid UI |
| Auth | Passport.js + JWT | Stateless, simple, no external dependencies |
| Hosting | Vercel + Railway | Cheap, simple, GitHub-integrated |
