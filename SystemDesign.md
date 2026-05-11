# Swimming Pool Cleaning Service — System Design Document

## Target Market

- **Location:** Dallas, Texas
- **Scale:** ~1 million users
- **Peak concurrency estimate:** ~10,000–50,000 simultaneous users (booking surges on Monday mornings, seasonal spikes in summer)

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
       │   CDN / Vercel  │  ← Static assets (JS, CSS, images)
       │   Edge Network  │    Cached API responses
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │  Load Balancer  │  ← Nginx / AWS ALB
       │  (Round Robin)  │    Health checks, SSL termination
       └────────┬────────┘
                │
       ┌────────┼────────┐
       │        │        │
  ┌────▼───┐ ┌──▼───┐ ┌──▼────┐
  │ App    │ │ App  │ │ App   │  ← Node.js + Express (TypeScript)
  │ Srv 1  │ │ Srv 2│ │ Srv N │    Stateless, horizontally scalable
  └───┬────┘ └──┬───┘ └──┬────┘
      │         │        │
      └─────────┼────────┘
                │
     ┌──────────┼──────────┐
     │          │          │
┌────▼───┐ ┌───▼────┐ ┌───▼──────────┐
│ Redis  │ │Postgres│ │ Object Store │
│ Cache  │ │   DB   │ │ (S3 / R2)    │
│        │ │        │ │ Photos       │
└────────┘ └───┬────┘ └──────────────┘
               │
          ┌────▼─────┐
          │ Read     │
          │ Replica  │
          └──────────┘
```

---

## Component Breakdown

### 1. CDN (Content Delivery Network)

- **What:** Vercel Edge or Cloudflare CDN
- **Why:** Serves the React SPA and static assets from edge nodes close to Dallas users. Reduces latency and offloads traffic from app servers.
- **Handles:** JS/CSS bundles, images, cached API responses

### 2. Load Balancer

- **What:** AWS Application Load Balancer (ALB) or Nginx
- **Why needed for 1M users:**
  - Distributes traffic across multiple app servers (round-robin or least-connections)
  - Health checks — automatically removes unhealthy servers from rotation
  - SSL termination — handles HTTPS so app servers don't have to
  - Zero-downtime deployments (rolling deploys behind the LB)
- **Without it:** A single server crash takes down the entire service

### 3. App Servers (Node.js + Express)

- **Instances:** Start with 2–3, auto-scale to 5+ based on CPU/memory
- **Stateless:** No session data stored on the server — sessions go to Redis
- **Why stateless matters:** Any request can go to any server, enabling horizontal scaling
- **Handles:** REST API, business logic, authentication, input validation

### 4. Redis Cache

- **What:** Managed Redis (AWS ElastiCache or Upstash)
- **Why:**
  - JWT session storage — since app servers are stateless, sessions must live externally
  - Cache frequently read data (technician schedules, available time slots)
  - Rate limiting (prevent booking spam)
- **Impact:** Reduces database queries by ~60–70% for read-heavy operations

### 5. PostgreSQL Database

- **Primary:** Handles all writes (new bookings, customer updates, maintenance records)
- **Read Replica:** Offloads read queries (customer history, schedule views, reporting)
- **Why replicas for 1M users:** Booking reads vastly outnumber writes. A single DB server would bottleneck on read queries during peak hours.
- **Managed service:** AWS RDS or Railway PostgreSQL (automated backups, failover)

### 6. Object Storage (S3 / Cloudflare R2)

- **What:** AWS S3 or Cloudflare R2
- **Why:** Before & after photos from technicians should NOT go in the database. Object storage is cheaper, faster, and infinitely scalable for binary files.
- **Flow:** App server generates a pre-signed upload URL → technician uploads directly to S3 → URL stored in database

### 7. External Services

| Service | Purpose |
|---|---|
| **Stripe** | Payment processing for invoices |
| **Twilio** | SMS appointment reminders |
| **SendGrid** | Email confirmations and notifications |

---

## Scaling Strategy

| Users | Infrastructure |
|---|---|
| **0–10K** | 1 app server, 1 DB, no LB needed |
| **10K–100K** | 2 app servers + load balancer, 1 DB with read replica, Redis |
| **100K–1M** | 3–5 app servers + ALB, DB primary + 2 read replicas, Redis cluster, CDN |
| **1M+** | Auto-scaling group (5–10 servers), DB sharding or connection pooling (PgBouncer), CDN caching aggressive |

---

## Data Flow — Booking an Appointment

```
Customer → CDN → Load Balancer → App Server
                                      │
                                      ├─→ Redis (check available slots cache)
                                      ├─→ PostgreSQL (write booking record)
                                      ├─→ SendGrid (confirmation email)
                                      └─→ Twilio (SMS reminder queued)
```

---

## Data Flow — Technician Uploading Photos

```
Technician PWA → CDN → Load Balancer → App Server
                                            │
                                            ├─→ App Server generates pre-signed S3 URL
                                            │
Technician PWA ─────────────────────────→ S3 (direct upload)
                                            │
                                            └─→ PostgreSQL (store photo URL in maintenance record)
```

---

## Security Architecture

- **SSL/TLS everywhere** — HTTPS enforced at load balancer
- **JWT tokens** — Short-lived access tokens (15 min) + refresh tokens (7 days)
- **Input validation** — Zod schemas on every API endpoint
- **Rate limiting** — Redis-based, per-IP and per-user
- **Pre-signed URLs** — Photos uploaded directly to S3, never passing through app servers
- **Database** — Parameterized queries via Prisma (SQL injection prevention)
- **Secrets** — Environment variables, never committed to repo

---

## Availability & Reliability

- **Uptime target:** 99.9% (< 9 hours downtime/year)
- **Health checks:** Load balancer pings `/health` every 30 seconds
- **Database backups:** Automated daily snapshots, 7-day retention
- **Failover:** If primary DB fails, read replica promotes to primary
- **Monitoring:** Sentry (errors), Datadog or CloudWatch (metrics), PagerDuty (alerts)

---

## Estimated Infrastructure Cost (1M Users)

| Component | Service | Est. Monthly Cost |
|---|---|---|
| App Servers (3x) | AWS EC2 t3.medium or Railway Pro | $60–$150 |
| Load Balancer | AWS ALB | $25 |
| PostgreSQL Primary | AWS RDS db.t3.medium | $70 |
| Read Replica | AWS RDS db.t3.medium | $70 |
| Redis | AWS ElastiCache t3.small | $25 |
| Object Storage | S3 / R2 | $10–$30 |
| CDN | Cloudflare (free tier) or Vercel | $0–$20 |
| **Total** | | **~$260–$390/month** |
