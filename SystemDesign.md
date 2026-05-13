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
       │   Vercel CDN    │  ← Static assets (JS, CSS, images)
       │   (Frontend)    │    React SPA served from edge
       └────────┬────────┘
                │ API calls
                │
       ┌────────▼────────┐
       │   App Server    │  ← Node.js + Express (TypeScript)
       │   (Railway)     │    Single instance, stateless
       └────────┬────────┘
                │
     ┌──────────┼──────────┬─────────────┬───────────┐
     │          │          │             │           │
┌────▼─────┐ ┌──▼───────┐ ┌▼─────────┐ ┌─▼──────┐ ┌──▼────┐
│PostgreSQL│ │Cloudflare│ │Nodemailer│ │ Twilio │ │Stripe │
│   (DB)   │ │    R2    │ │  (SMTP)  │ │ (SMS)  │ │(Pay)  │
│ Railway  │ │ (photos)*│ │Mailtrap**│ │        │ │       │
└──────────┘ └──────────┘ └──────────┘ └────────┘ └───────┘

*  Local disk for development, Cloudflare R2 for production
** Mailtrap for testing (catches emails), SendGrid for production
```

**Why this is enough:**
- ~20–200 concurrent users is well within a single server's capacity
- No load balancer needed — one app server handles this traffic easily
- No Redis needed — JWT is stateless (no server-side session storage), and express-rate-limit handles rate limiting in-memory
- No read replicas needed — PostgreSQL handles this read volume on a single instance
- See [TechnologyChoices.md](TechnologyChoices.md) for detailed rationale

---

## Component Breakdown

### 1. Frontend — Vercel CDN

- **What:** React SPA (TypeScript + Tailwind CSS) deployed on Vercel
- **Why:** Vercel serves static assets from edge nodes close to Dallas users. Reduces latency and offloads traffic from the app server.
- **Handles:** JS/CSS bundles, images, client-side routing
- **Cost:** Free tier

### 2. App Server — Node.js + Express (Railway)

- **What:** Single Node.js + Express server (TypeScript)
- **Stateless:** No session data on the server — JWT tokens carry auth state
- **Handles:** REST API, business logic, authentication, input validation
- **Why single server:** At ~20–200 concurrent users, one server has plenty of capacity. Add a second server only if response times degrade.
- **Cost:** Railway free tier → ~$5–$10/month on Pro

### 3. PostgreSQL Database (Railway)

- **What:** Single PostgreSQL instance on Railway
- **ORM:** Prisma (TypeScript, type-safe queries, migrations)
- **Handles:** All reads and writes — customers, pools, appointments, service records, invoices
- **Backups:** Railway automated daily snapshots
- **Cost:** Railway free tier → ~$5–$10/month on Pro

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
Customer → Vercel CDN → App Server (Railway)
                             │
                             ├─→ PostgreSQL (check available slots)
                             ├─→ PostgreSQL (write booking record)
                             ├─→ Nodemailer (confirmation email)
                             └─→ Twilio (SMS reminder queued)
```

---

## Data Flow — Technician Uploading Photos

### Development (Local Storage)

```
Technician → Vercel CDN → App Server (Railway)
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
Technician → Vercel CDN → App Server (Railway)
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

- **SSL/TLS everywhere** — HTTPS enforced by Vercel and Railway
- **JWT tokens** — Short-lived access tokens (15 min) + refresh tokens (7 days), stored in httpOnly cookies
- **Input validation** — Zod schemas on every API endpoint
- **Rate limiting** — express-rate-limit middleware (in-memory, per-IP)
- **Pre-signed URLs** — Photos uploaded directly to S3/R2, never passing through app server
- **Database** — Parameterized queries via Prisma (SQL injection prevention)
- **Secrets** — Environment variables managed by Railway, never committed to repo
- **CORS** — Restricted to Vercel frontend domain only

---

## Availability & Reliability

- **Uptime target:** 99.9% (< 9 hours downtime/year)
- **Health checks:** Railway monitors `/health` endpoint
- **Database backups:** Railway automated daily snapshots, 7-day retention
- **Monitoring:** Sentry (error tracking), Railway metrics (CPU, memory, response times)
- **Logging:** Structured JSON logs via Pino or Winston

---

## Estimated Infrastructure Cost (Current Scale)

| Component | Service | Est. Monthly Cost |
|---|---|---|
| Frontend hosting | Vercel (free tier) | $0 |
| App Server | Railway (free → Pro) | $0–$10 |
| PostgreSQL | Railway (free → Pro) | $0–$10 |
| Object Storage | Cloudflare R2 (free tier) | $0 |
| Domain + SSL | Vercel / Cloudflare | $0–$12/year |
| **Total** | | **$0–$25/month** |

> **When to upgrade:** If response times exceed 500ms consistently or Railway free tier limits are hit, move to Railway Pro (~$20/month total for server + DB). See [TechnologyChoices.md — Scaling Strategy](TechnologyChoices.md) for what to add at each growth stage.

---

## Key Concepts Explained

### What is a React SPA (Single Page Application)?

Instead of loading a new HTML page every time you click a link, a React SPA loads **one HTML page once**, then JavaScript handles all navigation and content updates without full page reloads.

- Browser downloads the React app (JS/CSS bundle) once from Vercel
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

**For this app (single region, Dallas):** The CDN benefit is minimal — all users are local. We use Vercel primarily for its **free hosting and auto-deploy pipeline**, not for the CDN. The CDN is a bonus that comes along for the ride.

| What Vercel gives us | Why we actually use it |
|---|---|
| Push to GitHub → auto-deploys | **Main reason** — zero-config deployment |
| Free hosting for React apps | **$0/month** |
| Preview URLs for every PR | Team can review before merging |
| Free SSL certificates | HTTPS with zero config |
| Edge caching (CDN) | Barely matters for single-region |

**Alternatives:** Netlify, Cloudflare Pages, AWS Amplify, Firebase Hosting

### What is an App Server?

The computer that runs your backend code. When a user books an appointment, their browser sends a request to this server, which processes it, saves to the database, and sends back a response.

- Receives API calls from the React frontend (e.g. `POST /api/appointments`)
- Validates input, checks authentication, runs business logic
- Reads/writes to PostgreSQL via Prisma
- Sends emails (Nodemailer) and SMS (Twilio)
- Returns JSON responses to the frontend

### What is Railway?

A cloud platform that runs your code — like renting a computer in the cloud. You push code to GitHub → Railway auto-deploys it and gives your server a public URL.

**We use Railway for two things:**

| What | Why |
|---|---|
| App Server (Node.js + Express) | Runs backend API code |
| PostgreSQL Database | Stores all data (customers, pools, appointments, invoices) |

**Why both on Railway:** Same platform = one dashboard, one bill, and low latency between server and database (~1-2ms since they're in the same data center).

**Alternatives:** Render, Fly.io, Heroku (no free tier), AWS EC2, DigitalOcean

### CDN vs. App Server — Why You Need Both

| | CDN (Vercel) | App Server (Railway) |
|---|---|---|
| **Serves** | Static files (HTML, CSS, JS, images) | Dynamic logic (API requests, database queries) |
| **Can run code?** | No (just delivers files) | Yes (Node.js, Express, business logic) |
| **Database access?** | No | Yes (connects to PostgreSQL) |
| **Processes bookings?** | No | Yes |
| **Sends emails/SMS?** | No | Yes |

**Analogy:** CDN = a vending machine (hands out pre-made items). App Server = the kitchen (takes orders, processes them, talks to the database).

### Where Everything Is Hosted — Summary

| Component | Hosted On | Why There |
|---|---|---|
| React frontend | **Vercel** | Free, auto-deploy, optimized for static sites |
| App Server (Express API) | **Railway** | Free tier, auto-deploy, same platform as DB |
| PostgreSQL database | **Railway** | Co-located with app server for low latency |
| Pool photos (dev) | **Local disk** | Zero setup, testing file upload logic |
| Pool photos (prod) | **Cloudflare R2** | $0 egress fees, free tier never expires |
| Email delivery | **Mailtrap** (testing) / **SendGrid** (production) | Test emails safely before going live |
| SMS delivery | **Twilio** | SMS delivery service |
| Payment processing | **Stripe** | PCI-compliant payment processor |