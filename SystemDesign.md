# Swimming Pool Cleaning Service — System Design Document

## Target Market

- **Location:** Dallas, Texas
- **Scale:** Hundreds to low thousands of total users (local service business)
- **Peak concurrency:** ~20–200 simultaneous users (Monday morning booking surges, seasonal summer spikes)
- **User roles:** Admin, Technician, Customer

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
- See [TechnologyChoices.md](TechnologyChoices.md) for detailed rationale

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

### 3. PostgreSQL Database (Render)

- **What:** Single PostgreSQL instance on Render
- **ORM:** Prisma (TypeScript, type-safe queries, migrations)
- **Handles:** All reads and writes — customers, pools, appointments, service records, invoices
- **Backups:** Render automated daily snapshots
- **Cost:** Render free tier → ~$5–$10/month on Pro

### 4. Object Storage — Pool Photos

- **What:** Storage for before & after pool cleaning photos
- **Why:** Binary files (images) should NOT go in the database. Object storage is cheaper, faster, and scalable.
- **Production choice:** **Cloudflare R2** — $0 egress fees, free tier never expires, S3-compatible
- **Development:** Local disk storage (files saved to `backend/uploads/`)
- **Flow:** App server generates pre-signed upload URL → technician uploads directly to R2 → URL stored in database

**Storage options comparison:**

| Option | Free Tier | Egress Fees | Best For |
|--------|-----------|-------------|----------|
| **Cloudflare R2** ✓ | 10 GB (never expires) | **$0** | Our choice for production |
| AWS S3 | 5 GB (12 months) | $0.09/GB | Enterprise, AWS ecosystem |
| Azure Blob | 5 GB (12 months) | $0.087/GB | Azure ecosystem |
| Local disk | Unlimited | N/A | Development only |

**Why R2 over S3/Azure:** Zero egress fees (viewing images is free), no credit card required, free tier doesn't expire.

### 5. External Services

| Service | Purpose | Cost |
|---|---|---|
| **Stripe** | Payment processing for invoices | 2.9% + $0.30 per transaction |
| **Twilio** | SMS appointment reminders | ~$0.0079/SMS |
| **Nodemailer** | Email confirmations (via Mailtrap for testing, SendGrid for production) | Free (Mailtrap free tier: 100/month) |

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

> **When to upgrade:** If response times exceed 500ms consistently or Render free tier limits are hit, move to Render Pro (~$20/month total for server + DB). See [TechnologyChoices.md — Scaling Strategy](TechnologyChoices.md) for what to add at each growth stage.

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