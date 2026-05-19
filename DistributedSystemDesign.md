# Distributed System Design — Pool Cleaning Service (At Scale)

> **Context:** The current app is a single-region service for Dallas, TX. This document shows how the architecture evolves when scaling to multiple regions, high traffic, and global users.

---

## Current State vs. Distributed Target

| Dimension | Today (Single Region) | At Scale (Distributed) |
|---|---|---|
| Users | Hundreds, one city | Millions, multiple regions |
| Servers | 1 Render instance | Multi-region app clusters |
| Database | 1 PostgreSQL | Primary + replicas + sharding |
| Caching | None | Redis (in-memory) |
| Static files | Served by Express | Global CDN |
| Notifications | In-process node-cron | Message queue + workers |
| Deployment | Render single service | Multi-region cloud (AWS/GCP) |

---

## Diagram 1 — Current Architecture (Single Region)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🔵 USERS — Dallas, TX                                                          │
│                                                                               │
│    ┌────────────────┐    ┌────────────────┐    ┌────────────────┐       │
│    │ 🖥️ Customer   │    │ 📱 Technician │    │ 🖥️ Admin      │       │
│    │    Browser    │    │    Mobile     │    │    Browser    │       │
│    └───────┬────────┘    └───────┬────────┘    └───────┬────────┘       │
└─────────────┼────────────────────┼─────────────────────┼─────────────────┘
                        └────────────────────┼────────────────────┘
                                             │
                                             ▼ HTTP requests
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟢 RENDER — Single Service                                                    │
│                                                                               │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐    │
│  │  ⚡ EXPRESS APP SERVER         │  │  ⏰ NODE-CRON                   │    │
│  │                                 │  │                                 │    │
│  │  • React static files           │  │  • 6am: tech summary            │    │
│  │  • /api/* routes                │  │  • 8am: reminders               │    │
│  │  • JWT authentication           │  │  • 9am: overdue invoices        │    │
│  └───────────────┬─────────────────┘  └───────────────┬─────────────────┘    │
└─────────────────┼──────────────────────────────────┼───────────────────────────┘
                  │                                  │
        ┌─────────┴─────────┬──────────────────────┴──────────┐
        ▼                   ▼                              ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 🟠 PostgreSQL   │  │ 🟠 Cloudflare  │  │ 🟣 SendGrid    │
│   (database)     │  │   R2 (photos)  │  │   (email)      │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                                           ┌──────────────────┐
                                           │ 🟣 Stripe      │
                                           │   (payments)   │
                                           └──────────────────┘
```

**Why this is enough today:**
- Single city → single server is fast for all users
- JWT is stateless → no session DB needed
- Low concurrency → one PostgreSQL instance is sufficient

---

## Diagram 2 — Distributed Architecture (Multi-Region Scale)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🔵 GLOBAL CLIENTS                                                             │
│                                                                               │
│    ┌────────────────┐      ┌────────────────┐      ┌────────────────┐     │
│    │ 🇺🇸 US Users   │      │ 🇪🇺 EU Users   │      │ 🌏 Asia Users │     │
│    └───────┬────────┘      └───────┬────────┘      └───────┬────────┘     │
└────────────┼───────────────────┼───────────────────┼────────────────────┘
             │ static              │ static              │ static
             ▼                     ▼                     ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟣 CDN — Cloudflare / CloudFront                                               │
│                                                                               │
│    ┌────────────────┐      ┌────────────────┐      ┌────────────────┐     │
│    │ 📦 Edge US    │      │ 📦 Edge EU    │      │ 📦 Edge Asia  │     │
│    │  CSS/JS/img   │      │  CSS/JS/img   │      │  CSS/JS/img  │     │
│    └────────────────┘      └────────────────┘      └────────────────┘     │
└───────────────────────────────────────────────────────────────────────────────┘
                                       │ API requests
                                       ▼
                    ┌───────────────────────────────────────┐
                    │  🟡 GLOBAL LOAD BALANCER             │
                    │  Routes to nearest healthy region    │
                    └──────────────────┬────────────────────┘
                                       │
                         ┌───────────┴───────────┐
                         ▼                       ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│  🟢 US EAST CLUSTER              │  │  🟢 EU WEST CLUSTER              │
│                                 │  │                                 │
│  ┌─────────────┐ ┌─────────────┐ │  │  ┌─────────────┐ ┌─────────────┐ │
│  │ ⚡ App      │ │ ⚡ App      │ │  │  │ ⚡ App      │ │ ⚡ App      │ │
│  │ Server 1   │ │ Server 2   │ │  │  │ Server 1   │ │ Server 2   │ │
│  └──────┬──────┘ └──────┬──────┘ │  │  └──────┬──────┘ └──────┬──────┘ │
│         └────────┴────────┘         │  │         └────────┴────────┘         │
│                 │                 │  │                 │                 │
│                 ▼                 │  │                 ▼                 │
│    ┌─────────────────────┐       │  │    ┌─────────────────────┐       │
│    │ 🔴 REDIS CACHE       │       │  │    │ 🔴 REDIS CACHE       │       │
│    │   US hot data       │       │  │    │   EU hot data       │       │
│    └──────────┬──────────┘       │  │    └──────────┬──────────┘       │
└──────────────┼──────────────────┘  └──────────────┼──────────────────┘
               │  cache miss                  │  cache miss
               ▼                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟠 DATABASE LAYER                                                            │
│                                                                               │
│       ┌─────────────────────────────────────────────────────────┐          │
│       │  🐘 PRIMARY DB — PostgreSQL                               │          │
│       │     (ALL WRITES go here)                                 │          │
│       └───────────────────┬─────────────────────────────────────┘          │
│                          │ replication                                       │
│          ┌───────────────┴───────────────┐                                   │
│          ▼                               ▼                                   │
│    ┌────────────────────┐       ┌────────────────────┐                        │
│    │ 📖 Read Replica 1  │       │ 📖 Read Replica 2  │                        │
│    │   (US reads)       │       │   (EU reads)       │                        │
│    └────────────────────┘       └────────────────────┘                        │
└───────────────────────────────────────────────────────────────────────────────┘
                                       │ enqueue jobs
                                       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🔴 MESSAGE QUEUE — RabbitMQ / SQS                                             │
│                                                                               │
│    ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐    │
│    │ 📧 email.reminder │    │ 📧 email.invoice  │    │ 🔔 push.notif    │    │
│    └─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘    │
│              │                    │                    │                    │
│              └─────────┬─────────┘                    │                    │
│                        ▼                              ▼                    │
│               ┌───────────────────┐        ┌───────────────────┐          │
│               │ 👷 Email Worker  │        │ 👷 Push Worker   │          │
│               └─────────┬─────────┘        └─────────┬─────────┘          │
│                         ▼                          ▼                        │
│               ┌───────────────────┐        ┌───────────────────┐          │
│               │ 📨 SendGrid/SES  │        │ 📱 Firebase FCM  │          │
│               └───────────────────┘        └───────────────────┘          │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│  🟢 OBJECT STORAGE — Cloudflare R2 ($0 egress, global)                         │
│    ▲ Photo uploads from all app servers                                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

**🎨 Color Legend:**
| Color | Meaning |
|---|---|
| 🔵 Blue | Clients / Users |
| 🟢 Green | App Servers (compute) |
| 🟠 Orange | Databases (storage) |
| 🔴 Red | Cache / Queues (fast/async) |
| 🟣 Purple | CDN (edge network) |
| 🟡 Yellow | Load Balancer (traffic routing) |

**Key architecture decisions:**
- **Read replicas scale reads, sharding scales writes** — you may use both at high scale
- **Load balancer pings `/health` endpoint** every 10 seconds to detect unhealthy servers
- **Consistent hashing** is preferred over range-based sharding to avoid hot spots
- All app servers connect to R2 for photo uploads/downloads (arrows shown above)

---

## Diagram 3 — Data Flow: Read vs. Write

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  🟢 READ PATH — GET /api/schedules                                                  │
│                                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ 🖥️ Client   │───▶│ 🔀 Load     │───▶│ ⚡ App      │───▶│ 🔴 Redis    │      │
│  │              │    │   Balancer   │    │   Server     │    │   Cache?     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                                      │              │
│                                          ┌───────────────────────────┴───────┐      │
│                                          │                                   │      │
│                                          ▼ ✅ HIT                     ❌ MISS ▼     │
│                               ┌──────────────────┐              ┌──────────────┐   │
│                               │ ⚡ Return data   │              │ 📖 Read      │   │
│                               │    ~1 µs         │              │   Replica    │   │
│                               └──────────────────┘              └──────┬───────┘   │
│                                                                        │           │
│                                                                        ▼           │
│                                                              ┌──────────────────┐  │
│                                                              │ 💾 Store in cache│  │
│                                                              │    TTL 5min      │  │
│                                                              └────────┬─────────┘  │
│                                                                       ▼            │
│                                                              ┌──────────────────┐  │
│                                                              │ 📤 200 OK        │  │
│                                                              └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  🟠 WRITE PATH — POST /api/schedules                                                │
│                                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ 🖥️ Client   │───▶│ 🔀 Load     │───▶│ ⚡ App      │───▶│ 🐘 Primary  │      │
│  │              │    │   Balancer   │    │   Server     │    │   DB INSERT  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                                      │ confirm     │
│                                                                      ▼              │
│                                                              ┌──────────────────┐  │
│                                                              │ 🗑️ Invalidate   │  │
│                                                              │   cache keys     │  │
│                                                              └────────┬─────────┘  │
│                                                                       ▼            │
│                                                              ┌──────────────────┐  │
│                                                              │ 📤 201 Created   │  │
│                                                              └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Reads hit cache first (fast), writes go to primary DB then invalidate cache.

---

## Diagram 4 — Notification Flow at Scale (Message Queue)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🔵 TRIGGERS                                                                   │
│                                                                               │
│    ┌─────────────────────┐         ┌─────────────────────┐                   │
│    │ ⏰ Scheduled Cron   │         │ ⚡ API Event        │                   │
│    │    8am daily        │         │   invoice completed │                   │
│    └──────────┬──────────┘         └──────────┬──────────┘                   │
└───────────────┼────────────────────────────────┼──────────────────────────────┘
                │ enqueue                        │ enqueue
                ▼                                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🔴 MESSAGE QUEUE — SQS / RabbitMQ                                            │
│                                                                               │
│    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│    │ 📧 email        │  │ 📧 email        │  │ 🔔 push         │             │
│    │   .reminder     │  │   .invoice      │  │   .notification │             │
│    └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└─────────────┼────────────────────┼────────────────────┼───────────────────────┘
              │                    │                    │
              └────────────┬───────┘                    │
                           ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟢 WORKER SERVICES (auto-scale)                                              │
│                                                                               │
│         ┌─────────────────────┐           ┌─────────────────────┐            │
│         │ 📧 Email Worker     │           │ 📱 Push Worker      │            │
│         └──────────┬──────────┘           └──────────┬──────────┘            │
└────────────────────┼──────────────────────────────────┼───────────────────────┘
                     ▼                                  ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟣 DELIVERY SERVICES                                                         │
│                                                                               │
│         ┌─────────────────────┐           ┌─────────────────────┐            │
│         │ 📨 SendGrid / SES   │           │ 🔔 Firebase FCM     │            │
│         │   transactional     │           │   mobile push       │            │
│         │   email             │           │                     │            │
│         └─────────────────────┘           └─────────────────────┘            │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Why Do We Need a Message Queue?

**❌ Without Queue (your current setup):**
```
User clicks "Send Invoice"
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  API waits... ──▶ SendGrid sends email ──▶ API responds │
│                          │                            │
│                          └─ If slow/down = user waits │
│                             or sees error!            │
└──────────────────────────────────────────────────────┘
```

**✅ With Queue (at scale):**
```
User clicks "Send Invoice"
        │
        ▼
┌─────────────────────────────────────────────┐
│  API adds job to queue ──▶ API responds ✅  │  (instant!)
└─────────────────────────────────────────────┘
        │
        ▼ (async, in background)
┌─────────────────────────────────────────────┐
│  Worker picks up job ──▶ Sends email        │
│         └─ If fails, retries automatically  │
└─────────────────────────────────────────────┘
```

**Benefits of Message Queue:**

| Problem | How Queue Solves It |
|---------|---------------------|
| Email service slow → API hangs | API returns instantly, worker handles it |
| Email service down → user sees error | Job stays in queue, retries when service recovers |
| 10,000 users need reminders at 8am | Workers process in parallel, API isn't blocked |
| Server crashes mid-send | Queue persists jobs, nothing lost |

---

### SendGrid vs Nodemailer — What's the Difference?

| | **Nodemailer** | **SendGrid** |
|---|---|---|
| **What it is** | Library (npm package) | Service (company/API) |
| **Sends email itself?** | ❌ No — needs an SMTP server | ✅ Yes — IS the email infrastructure |
| **You configure** | SMTP host, port, credentials | Just an API key |
| **Deliverability** | Depends on your SMTP server | High — they handle spam reputation, DKIM, SPF |
| **Tracking** | None built-in | Opens, clicks, bounces, unsubscribes |
| **Cost** | Free (but need SMTP server) | Free tier (100/day), then paid |

**Code comparison:**

```ts
// Nodemailer — YOU need an SMTP server (Gmail, your own mail server, etc.)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',  // ← External SMTP provider required
  port: 587,
  auth: { user: 'you@gmail.com', pass: 'app-password' }
});
await transporter.sendMail({ to, from, subject, html });

// SendGrid — THEY are the email infrastructure
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
await sgMail.send({ to, from, subject, html });  // ← Calls their API directly
```

**Why this app uses SendGrid:**
- ✅ No SMTP server to manage
- ✅ High deliverability (emails don't go to spam)
- ✅ Free tier is enough for small scale (100 emails/day)
- ✅ Built-in analytics (who opened, who clicked)
- ❌ Nodemailer + Gmail would hit rate limits and deliverability issues at scale

---

## Diagram 5 — Database Sharding by Region

```
                    ┌─────────────────────────┐
                    │ 📨 Incoming Request     │
                    │    user_id = 9821       │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ 🟡 SHARD ROUTER         │
                    │ Which DB has user 9821? │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ 🟣 GLOBAL INDEX DB      │
                    │   user_id → shard_id    │
                    └───────────┬─────────────┘
                                │ 🇺🇸 shard = US
                                ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟠 REGIONAL SHARDS                                                           │
│                                                                               │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐│
│  │ 🇺🇸 US Shard          │ │ 🇪🇺 EU Shard          │ │ 🌏 Asia Shard         ││
│  │  ▀▀▀▀▀▀▀▀▀            │ │                       │ │                       ││
│  │  1–5M users           │ │  5M–10M users         │ │  10M+ users           ││
│  │  users, pools,        │ │  users, pools,        │ │  users, pools,        ││
│  │  invoices             │ │  invoices             │ │  invoices             ││
│  │  ◄── QUERY HERE       │ │                       │ │                       ││
│  └───────────────────────┘ └───────────────────────┘ └───────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ ✅ Query executes only  │
                    │    on US shard          │
                    └─────────────────────────┘
```

**Sharding rules for Pool Service expansion:**
- **Consistent hashing** is preferred over range-based sharding — range-based can cause hot spots when new users cluster in one range
- Each region's data stays in that region (GDPR compliance for EU)
- Global index is a lightweight lookup table — but **in production it's also replicated** (it's a single point of failure otherwise)
- Pools, schedules, invoices all live in the same shard as the user who owns them

---

## Diagram 6 — Graceful Degradation (Circuit Breaker Pattern)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🟢 NORMAL FLOW — Circuit CLOSED                                               │
│                                                                               │
│    ┌───────────────┐      ✅       ┌───────────────┐             ┌─────────┐ │
│    │ ⚡ App Server │─────────▶│ 🔴 Redis Cache │────────────▶│ 📤 OK  │ │
│    └───────────────┘              └───────────────┘             └─────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│  🔴 FAILURE — Circuit OPEN                                                     │
│                                                                               │
│    ┌───────────────┐      ❌       ┌───────────────┐                      │
│    │ ⚡ App Server │── timeout ─▶│ 🔴 Redis DOWN │                      │
│    └───────┬───────┘              └───────────────┘                      │
│            │                                                                  │
│            │  🚨 Circuit opens!                                                │
│            ▼                                                                  │
│    ┌─────────────────────────┐             ┌─────────────────────────┐    │
│    │ 🔄 FALLBACK:             │────────────▶│ 📤 Degraded Response    │    │
│    │   Query DB directly     │             │   (slower but works)    │    │
│    └─────────────────────────┘             └─────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│  🟡 RECOVERY — Circuit HALF-OPEN                                              │
│                                                                               │
│    ┌───────────────┐    🧪 try    ┌───────────────┐                        │
│    │ ⚡ App Server │── one req ─▶│ 🔴 Redis     │                        │
│    └───────────────┘             └───────┬───────┘                        │
│                                          │                                    │
│                        ┌───────────────┴───────────────┐                    │
│                        ▼                               ▼                    │
│               ┌─────────────────────┐    ┌─────────────────────────┐      │
│               │  ✅ success            │    │  ❌ still failing          │      │
│               └─────────┬───────────┘    └──────────┬──────────────┘      │
│                         ▼                           ▼                        │
│               ┌─────────────────────┐    ┌─────────────────────────┐      │
│               │ ✅ Close circuit     │    │ 🚫 Keep circuit open    │      │
│               │   back to normal     │    │   continue fallback      │      │
│               └─────────────────────┘    └─────────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────────┘
```

**🚦 Circuit breaker states:**
| State | Color | Behavior |
|---|---|---|
| ✅ **CLOSED** | Green | Normal operation, requests flow through |
| 🚫 **OPEN** | Red | Too many failures, skip failing service, use fallback |
| 🔍 **HALF-OPEN** | Yellow | After cooldown, try one request to test recovery |

**Fallback strategies for Pool Service:**

| Service Down | Fallback Behavior |
|---|---|
| Redis cache | Query database directly (slower) |
| Read replica | Temporarily read from primary (adds load) |
| Email service | Queue job for retry, don't fail the API request |
| Stripe | Show "payment temporarily unavailable", save intent for retry |

---

## Key Concepts Summary

### When to Add Each Component

| Traffic Level | Add This |
|---|---|
| 0–500 users | Single server, single DB (current setup) |
| 500–5,000 | Read replicas for DB |
| 5,000–50,000 | Redis cache + load balancer |
| 50,000–500,000 | CDN for static assets + message queue |
| 500,000+ | DB sharding + multi-region deployment |

### CAP Theorem (Distributed Systems Trade-off)

In a distributed system you can only guarantee **two of three**:

| Property | Meaning |
|---|---|
| **Consistency** | Every read gets the most recent write |
| **Availability** | Every request gets a response (no errors) |
| **Partition Tolerance** | System works even if network splits occur |

For Pool Service at scale: choose **AP** (Availability + Partition Tolerance). It's acceptable if a customer briefly sees a slightly stale appointment list — but the app must always respond.

**Eventual consistency:** AP systems don't guarantee immediate consistency — data syncs across replicas within seconds, not instantly. A user who books an appointment may not see it immediately if their next read hits a replica that hasn't received the write yet.

### Replication Lag Warning

Read replicas can be **seconds behind** the primary database. This matters for:

| Scenario | Problem | Solution |
|---|---|---|
| User books appointment, immediately views schedule | May not see the new booking | Read from primary after writes ("read-your-writes" consistency) |
| Admin updates pricing, customer sees old price | Stale data displayed | Use cache invalidation + short TTL |
| Technician completes job, invoice not generated | Write hasn't propagated | Critical workflows should read from primary |

### The Latency Numbers Every Engineer Should Know

| Storage | Approximate Read Time |
|---|---|
| CPU L1 cache | ~1 ns |
| RAM / Redis | ~100 ns – 1 µs |
| SSD (local) | ~100 µs |
| Network round-trip (same region) | ~0.5–1 ms |
| PostgreSQL (same region) | ~1–5 ms |
| Cross-region DB call | ~50–150 ms |
| User perception of "slow" | > 200 ms |

This is why caching matters: serving from Redis (1 µs) vs hitting the DB (5 ms) is a 5,000× speed difference.

---

## Advanced Topics 

### Rate Limiting

Prevents abuse and protects backend services from being overwhelmed.

```
              ┌────────────────────┐
              │ 📨 Client Request │
              └─────────┬──────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────┐
│  🟡 LOAD BALANCER / API GATEWAY               │
│  🚦 Rate limit: 100 req/min per IP           │
└────────────────────────┬──────────────────────────┘
                         │
             ┌───────────┴───────────┐
             ▼ Under limit?         ▼
  ┌─────────────────────┐  ┌─────────────────────┐
  │ ✅ Yes               │  │ ❌ No                │
  └─────────┬───────────┘  └─────────┬───────────┘
            ▼                        ▼
  ┌─────────────────────┐  ┌─────────────────────┐
  │  🟢 ⚡ Forward to     │  │  🔴 🚫 429 Too Many │
  │     App Server      │  │     Requests        │
  └─────────────────────┘  └─────────────────────┘
```

**Where rate limiting lives:**
- **API Gateway** (AWS API Gateway, Kong) — best for public APIs
- **Load Balancer** (nginx, HAProxy) — good for internal rate limiting
- **Application level** (express-rate-limit) — fine for small scale, but doesn't work across multiple servers without Redis

### Database Connection Pooling

Without pooling: each request opens a new DB connection → expensive, slow, exhausts DB connections.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🔴 WITHOUT POOLING — Slow (50-100ms overhead per request)                     │
│                                                                               │
│  📨 Request 1 ──▶ 🔌 Open ──▶ 📝 Query ──▶ ❌ Close                          │
│  📨 Request 2 ──▶ 🔌 Open ──▶ 📝 Query ──▶ ❌ Close                          │
│  📨 Request 3 ──▶ 🔌 Open ──▶ 📝 Query ──▶ ❌ Close                          │
│                                                                               │
│  ⚠️  Each connection = 50-100ms overhead + exhausts DB connection limit      │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│  🟢 WITH POOLING (PgBouncer) — Fast (connections reused instantly)            │
│                                                                               │
│      📨 Request 1 ──┐                                                        │
│      📨 Request 2 ──┼──▶ ┌─────────────────────────────┐       ┌───────────┐│
│      📨 Request 3 ──┘    │ 🏊 CONNECTION POOL        │─────▶│ 🐘 Postgres││
│                         │   20 pre-opened conns    │ ⚡    └───────────┘│
│                         └─────────────────────────────┘ instant          │
│                                                                               │
│  ✅ Connections are reused — no open/close overhead per request               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Pool settings to tune:**
- `pool_size`: Max connections (start with 20, increase based on load)
- `idle_timeout`: How long unused connections stay open
- `connection_timeout`: How long to wait for a free connection

### Blue-Green / Canary Deployments

How do you deploy without downtime?

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  🔵🟢 BLUE-GREEN DEPLOYMENT                                                    │
│                                                                               │
│                    ┌─────────────────────────┐                              │
│                    │ 🟡 LOAD BALANCER        │                              │
│                    └────────────┬────────────┘                              │
│                                │                                             │
│              ┌─────────────────┴─────────────────┐                         │
│              ▼ 100% traffic                  ▼ 🔄 switch                    │
│    ┌───────────────────────┐        ┌───────────────────────┐           │
│    │ 🔵 BLUE v1.0         │        │ 🟢 GREEN v1.1        │           │
│    │   current prod       │   ⇄   │   new version        │           │
│    └───────────────────────┘        └───────────────────────┘           │
│                                                                               │
│    → Both versions run simultaneously                                        │
│    → Instant rollback: just switch traffic back to Blue                      │
└───────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────┐
│  🐦 CANARY DEPLOYMENT                                                         │
│                                                                               │
│                    ┌─────────────────────────┐                              │
│                    │ 🟡 LOAD BALANCER        │                              │
│                    └────────────┬────────────┘                              │
│                                │                                             │
│              ┌─────────────────┴─────────────────┐                         │
│              ▼ 🟢 95% traffic              ▼ 🟡 5% traffic                  │
│    ┌───────────────────────┐        ┌───────────────────────┐           │
│    │ ✅ v1.0 stable       │        │ 🐦 v1.1 canary       │           │
│    └───────────────────────┘        └───────────┬───────────┘           │
│                                               │                              │
│                                       📈 monitor errors                      │
│                                               │                              │
│                               ┌───────────────┴───────────────┐                │
│                               ▼ ✅ Healthy?                  ▼                │
│                 ┌─────────────────────┐        ┌─────────────────────┐      │
│                 │ 🚀 Yes → Increase   │        │ ⚠️ No → Rollback    │      │
│                 │    to 100%         │        │    to v1.0         │      │
│                 └─────────────────────┘        └─────────────────────┘      │
└───────────────────────────────────────────────────────────────────────────────┘
```

**When to use which:**
- **Blue-green**: Simpler, instant switchover, good for smaller teams
- **Canary**: Safer for large user bases, catches issues before full rollout
