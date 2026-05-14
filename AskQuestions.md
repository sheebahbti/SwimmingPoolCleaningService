# Pre-Build Discovery Questions — Ask Before Writing Any Code

---

## 1. Users & Scale

| # | Question | Why It Matters | Our Answer (Pool Cleaning App) |
|---|---|---|---|
| 1.1 | How many **total users** will the app have? | Determines database size, storage, and backup strategy | Hundreds to low thousands (local Dallas business) |
| 1.2 | How many **concurrent users** at peak? | Determines if you need load balancing, caching, multiple servers | ~20–200 (Monday morning booking surges) |
| 1.3 | What are the **user roles**? | Shapes auth, permissions, and UI views | Admin, Technician, Customer |
| 1.4 | Will the user base **grow rapidly** or stay stable? | Decides whether to build for scale now or start simple | Stable — local service business, gradual growth |

---

## 2. Geography & Region

| # | Question | Why It Matters | Our Answer |
|---|---|---|---|
| 2.1 | Where are your users located? **One city, one country, or global?** | Determines single-region vs. multi-region architecture | Dallas, Texas — single region |
| 2.2 | Do users need **low-latency** access from multiple regions? | Decides if you need CDN, geo-DNS, regional replicas | No — all users are local |

---

## 3. Data & Database

| # | Question | Why It Matters | Our Answer |
|---|---|---|---|
| 3.1 | Is your data **relational** (clear entities with relationships) or **unstructured** (flexible, nested, varies per record)? | Relational → SQL (PostgreSQL). Unstructured → NoSQL (MongoDB) | Relational — Customers → Pools → Appointments → Records |
| 3.2 | How much **data** will you store? (GB? TB?) | Affects database choice, storage costs, backup strategy | Small — a few GB at most |
| 3.3 | Is the app **read-heavy or write-heavy**? | Read-heavy → consider caching/replicas. Write-heavy → consider write-optimized DBs | Read-heavy (viewing schedules) but low volume |
| 3.4 | Do you need **real-time data** (live updates, WebSockets)? | Adds complexity — may need pub/sub, WebSocket server | No — standard request/response is fine |
| 3.5 | Do you need to store **files/images/videos**? | Files should never go in the database — need object storage (S3/R2) | Yes — before/after pool photos |

---

## 4. Authentication & Security

| # | Question | Why It Matters | Our Answer |
|---|---|---|---|
| 4.1 | How will users **log in**? (Email/password, social login, SSO?) | Determines auth provider choice | Email/password with JWT |
| 4.2 | Do you need **role-based access control**? | Affects API middleware and frontend route guards | Yes — Admin, Technician, Customer see different things |
| 4.3 | Will you handle **payments or sensitive data**? | Requires PCI compliance, encryption, secure token handling | Yes — Stripe handles PCI compliance |
| 4.4 | Do you need **rate limiting**? | Prevents abuse, spam, and bot attacks | Yes — but Express middleware (express-rate-limit) is enough at our scale. Redis-based rate limiting only needed at 1,000+ concurrent users |

---

## 5. Features & Complexity

| # | Question | Why It Matters | Our Answer |
|---|---|---|---|
| 5.1 | What is the **core feature** the app must have on day one? | Defines your MVP scope — build this first, everything else is later | Booking appointments and assigning technicians |
| 5.2 | Does the app need **scheduling/calendar** functionality? | May need a calendar library (FullCalendar) and conflict detection logic | Yes — core feature (conflict detection skipped for MVP) |
| 5.3 | Does the app need **email or SMS notifications**? | Requires third-party services (SendGrid, Twilio) and async processing | Yes — appointment confirmations and reminders |
| 5.4 | Does the app need **payment processing**? | Requires Stripe/PayPal integration, webhook handling, invoice generation | Yes — but can launch with manual payments first |
| 5.5 | Does the app need **offline support**? | Requires PWA with service workers, local storage, sync logic | Nice-to-have for technicians in the field (Phase 10) |
| 5.6 | Does the app need **search**? (Simple filters vs. full-text search) | Simple → SQL queries. Complex → Elasticsearch or Algolia | Simple — filter customers by name, filter appointments by date |
| 5.7 | Does the app need **reporting/analytics**? | May need dashboards, charts, data aggregation queries | Basic — revenue reports, appointment counts |

---

## 6. Team & Timeline

| # | Question | Why It Matters | Our Answer |
|---|---|---|---|
| 6.1 | What is the **full team** needed to build this? | Understaffing kills projects — dev alone isn't enough | See [ImplementationPhases.md — Phase 2](ImplementationPhases.md) |
| 6.2 | What **languages/frameworks** does the team already know? | Don't pick a stack nobody knows — learning curve kills timelines | TypeScript, React, Node.js |
| 6.3 | What is the **deadline** for the MVP? | Determines scope — cut features, not quality | ~7–8 weeks with AI — see [ImplementationPhases.md](ImplementationPhases.md) |
| 6.4 | Is this a **one-time build** or will it be maintained long-term? | Long-term → invest in tests, CI/CD, documentation | Long-term — ongoing service business |


---

## 7. Deployment & Budget

| # | Question | Why It Matters | Our Answer |
|---|---|---|---|
| 7.1 | What is the **monthly infrastructure budget**? | Determines hosting choice — free tiers vs. cloud providers | Low — start with free tiers ($0–$25/month) |
| 7.2 | Do you need **CI/CD** (automated testing and deployment)? | Saves time, catches bugs early, enables safe deploys | Yes — GitHub Actions |
| 7.3 | Where will you **host** the app? | Affects cost, complexity, and scaling options | Render (single service — backend + frontend + DB) |
| 7.4 | Do you need a **staging environment**? | Test changes before they hit production | Yes — before go-live |
| 7.5 | What is the **uptime requirement**? (99%? 99.9%? 99.99%?) | Higher uptime = more infrastructure, more cost | 99.9% is sufficient for a local service business |

---

## 8. Third-Party Integrations

| # | Question | Why It Matters | Our Answer |
|---|---|---|---|
| 8.1 | Do you need to integrate with **any existing systems**? (CRM, ERP, accounting software) | Adds API integration work and potential data sync issues | No — greenfield app |
| 8.2 | Do you need **maps or routing**? (Google Maps, route optimization) | Adds API costs and complexity | Nice-to-have for technician routing (future) |
| 8.3 | Do you need **PDF generation**? (Invoices, reports) | Requires a library (PDFKit, Puppeteer) | Yes — invoices (Phase 9) |

---

## How to Use This Document

1. **Answer every question before choosing your tech stack.** The answers drive the architecture.
2. **If most answers are `small/simple/local`** — keep the stack simple (PostgreSQL, single server, free tiers).
3. **If answers point to `large/global/complex`** — invest in distributed infrastructure (Redis, load balancers, multi-region).
4. **Revisit these questions every 6 months** as the business grows — your answers may change, and the architecture should evolve with them.

---

## Sample Answers Summary — Swimming Pool Cleaning Service (Dallas, TX)

### Must-Ask Questions (Before Writing Any Code)

| # | Question | Answer | Impact on Tech Choice |
|---|---|---|---|
| 1.1 | Total users | Hundreds to low thousands | Small DB — PostgreSQL on Render (free tier) |
| 1.2 | Concurrent users | ~20–200 at peak | No load balancer, no Redis, single server is fine |
| 1.3 | User roles | Admin, Technician, Customer | Passport.js + JWT with role claims |
| 1.4 | Growth rate | Stable, gradual | No need to over-engineer for scale |
| 2.1 | User location | Dallas, Texas only | Single-region deployment on Render |
| 3.5 | File storage | Yes — pool photos | S3 / Cloudflare R2 for object storage |
| 4.3 | Payments | Yes | Stripe handles PCI compliance |
| 5.2 | Calendar | Yes — core feature | FullCalendar (React) |
| 5.7 | Reporting | Basic — revenue, appointment counts | SQL aggregation queries — no analytics platform |
| 6.1 | Team size | ~6.5 people (4.75 FTE) | Simple stack — monolith, not microservices |
| 6.3 | Delivery date | ~7–8 weeks for MVP with AI | Focus on Phases 1–6 first |
| 7.3 | Hosting | Render (single service) | Simple, cheap, GitHub-integrated |

### Ask Later (Future Phases)

| # | Question | Default for Now | Revisit When |
|---|---|---|---|
| 2.2 | Multi-region latency | Not needed — single region | Expanding beyond Dallas |
| 3.1 | Data structure | Relational → PostgreSQL | Never (unlikely to change) |
| 3.2 | Data size | A few GB | Hitting storage limits |
| 3.3 | Read/write ratio | Read-heavy, low volume | Performance issues appear |
| 3.4 | Real-time data | No — standard REST API | Need live updates (e.g., technician tracking) |
| 4.1 | Login method | Email/password with JWT | Adding social login or SSO |
| 4.2 | Role-based access | Yes — JWT role claims | Adding new roles |
| 4.4 | Rate limiting | express-rate-limit middleware | Scaling past 1,000 concurrent users |
| 5.1 | Core feature (MVP) | Booking + technician assignment | MVP is delivered |
| 5.3 | Notifications | Email + SMS (Nodemailer + Twilio) | Phase 8 |
| 5.4 | Payment timing | Manual payments for MVP | Phase 9 (Stripe integration) |
| 5.5 | Offline support | Not needed yet | Phase 10 (technician PWA) |
| 5.6 | Search | Simple SQL filters | Need full-text search |
| 6.2 | Team skills | TypeScript, React, Node.js | Hiring new team members |
| 6.4 | Maintenance | Long-term — invest in CI/CD | Always |
| 7.1 | Budget | $0–$25/month | Scaling up |
| 7.2 | CI/CD | GitHub Actions | Always |
| 7.4 | Staging env | Yes | Phase 11 (go-live) |
| 7.5 | Uptime | 99.9% | Going to production |
| 8.1 | Existing systems | None — greenfield | Integrating CRM/accounting |
| 8.2 | Maps/routing | Not needed yet | Technician route optimization |
| 8.3 | PDF generation | Yes — invoices | Phase 9 |
