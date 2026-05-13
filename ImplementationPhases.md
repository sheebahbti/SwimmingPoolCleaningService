# Swimming Pool Cleaning Service — Implementation Phases

---

## Phase 1 — Choosing Technology

See [TechnologyChoices.md](TechnologyChoices.md) for full technology decisions, rationale, NoSQL comparison, and scaling strategy.

**Summary of choices:** Node.js + Express (TypeScript), PostgreSQL + Prisma, React + Tailwind, Passport.js + JWT, FullCalendar, Nodemailer + Twilio, Stripe, Vercel + Railway.

---

## Phase 2 — Choosing Team

- **Project Manager (1)** — Owns timeline, coordinates across phases, removes blockers
- **Dev Manager (1)** — Technical leadership, code reviews, architecture decisions, mentors developers
- **Full-Stack Developer (2)** — Node.js/Express backend + React frontend; both should be strong in TypeScript
- **UI/UX Designer (1, ~50%)** — Designs customer-facing booking flow, technician mobile views, and admin dashboard
- **QA Engineer (1)** — Manual + automated testing; writes integration tests from Phase 4 onward
- **DevOps / Cloud Engineer (0.5, part-time)** — Sets up CI/CD pipeline, deployment to Railway/Vercel, database backups

**Total team: 6.5 people (4.75 FTE)**

### Team Notes

- All team members use AI tools (GitHub Copilot, ChatGPT, Cursor) throughout development.
- AI accelerates code generation, documentation, and boilerplate but cannot replace: hiring decisions, UX research, domain expertise, stakeholder alignment, QA edge-case testing, security reviews, and production incident response.
- For an MVP, the full team covers Phases 1–6 in **~7–8 weeks** with AI-assisted development.
- Consider a domain expert (pool service industry) as an advisor for workflow validation.

---

## Phase 3 — System Design Document

- Define high-level architecture: client (React SPA) → API (Express) → database (PostgreSQL)
- Create entity-relationship diagram: `Customers`, `Pools`, `Appointments`, `MaintenanceRecords`, `Technicians`, `Invoices`
- Design REST API contract (endpoints, request/response schemas, status codes)
- Define authentication & authorization flows (roles: Admin, Technician, Customer)
- Plan database schema with Prisma models, relationships, and indexes
- Document deployment architecture (Vercel + Railway/Render topology)
- Identify non-functional requirements: performance targets, uptime SLA, data retention policy
- Produce wireframes / mockups for key screens (booking flow, calendar, dashboard)

**Why Phase 3:** A solid design doc prevents rework. The team (Phase 2) needs a shared blueprint before writing code.

---

## Phase 4 — Foundation & Infrastructure

- Initialize Node.js + Express (TypeScript) backend and React frontend (separate projects)
- Set up PostgreSQL with Prisma; implement the schema from the design document
- Configure Passport.js + JWT authentication
- Set up GitHub Actions CI pipeline (build + test on every push)

**Why Phase 4:** Everything else depends on auth and the data model. Getting the schema right early avoids painful migrations later.

---

## Phase 5 — User & Pool Management

- CRUD endpoints for **all user types** with role-based access:
  - **Admin** — manages technicians, customers, schedules, and business settings
  - **Technician** — views assigned appointments, logs maintenance records, uploads photos
  - **Customer** — books appointments, views service history, manages their pools
- User registration and profile management (name, contact, address, role)
- Admin can create/edit/deactivate technician and customer accounts
- Each customer can have one or more `Pool` records (size, type, location notes)
- React pages: user list (filtered by role), user detail/edit, add pool (for customers)

**Why Phase 5:** Users are the root entity — appointments, maintenance records, and pools all hang off them. All three roles must exist before scheduling can work.

---

## Phase 6 — Appointment Scheduling

- Endpoints to create/update/cancel appointments; assign a technician; set status (`Scheduled`, `InProgress`, `Completed`, `Cancelled`)
- FullCalendar view showing all appointments by day/week
- ~~Conflict detection (prevent double-booking a technician)~~ — **Skipped for MVP**
- Email confirmation via Nodemailer on booking

**Why Phase 6:** Core value of the service; requires customers and technicians to already exist.

---

## Phase 7 — Service Photos & History

- After an appointment is marked `Completed`, technicians upload before and after photos of the pool
- **Storage approach:**
  - **Development:** Local disk (`backend/uploads/` folder) — zero setup, test upload logic
  - **Production:** Cloudflare R2 — $0 egress fees, free tier never expires
- File upload via `multer` middleware, pre-signed URLs for direct browser uploads in production
- Customer-facing history view ("your last 5 services")
- Alerts when a pool is overdue for service

**Why Phase 7:** Depends on completed appointments; drives customer retention and trust.

---

## Phase 8 — Notifications & Reminders ✅

- ✅ Automated 24-hour appointment reminders (email via Nodemailer)
- ✅ Technician daily schedule summary email
- ✅ Re-engagement emails for customers with no appointment in 30+ days
- All jobs run via `node-cron` scheduler (`backend/src/lib/scheduler.ts`)
- SMS via Twilio — deferred to later

| Cron Job | Schedule | What It Does |
|---|---|---|
| Daily summary | 6:00 AM daily | Sends each technician their day's jobs |
| Appointment reminders | 8:00 AM daily | Emails customers with appointments tomorrow |
| Overdue invoices | 9:00 AM daily | Marks past-due invoices OVERDUE + sends payment reminders |
| Re-engagement | 9:00 AM Mondays | Emails customers inactive 30+ days |

**Why Phase 8:** Requires the scheduling and customer modules to be stable before automating on top of them.

---

## Phase 9 — Invoicing & Payments ✅

- ✅ Auto-generate invoice ($150, 14-day due) when maintenance record is created and schedule marked COMPLETED
- ✅ Stripe integration for online payment (PaymentIntent flow)
- ✅ Invoice PDF generation via PDFKit (styled with header, service table, totals)
- ✅ Payment status tracking (PENDING → PAID / OVERDUE)
- ✅ Overdue invoice auto-detection and email reminders (daily 9 AM cron)
- ✅ Frontend InvoicesPage — summary cards, filterable table, PDF download, admin "Mark Paid"
- ✅ Role-based access: Admin sees all invoices, Customer sees own invoices

| Component | File | What It Does |
|---|---|---|
| Controller | `backend/src/controllers/invoice.controller.ts` | CRUD + pay + confirm + PDF download |
| Routes | `backend/src/routes/invoice.routes.ts` | 7 endpoints (GET, POST, PATCH) |
| Stripe service | `backend/src/lib/stripe.ts` | PaymentIntent create + verify |
| PDF service | `backend/src/lib/pdf.ts` | Generates styled invoice PDF |
| Scheduler | `backend/src/lib/scheduler.ts` | Marks overdue + sends reminders |
| Frontend | `frontend/src/pages/InvoicesPage.tsx` | Invoice list with filters + actions |

**Why Phase 9:** Revenue-critical but can be done manually (cash/check) initially while earlier phases are validated.

---

## Phase 10 — Mobile / Field Technician PWA ⏭️ Deferred

- Progressive Web App view optimized for phones
- Technicians can: view their daily route, mark appointments in progress/complete, log maintenance records from the job site
- Offline-capable with service worker caching

**Why deferred:** The app already works in a mobile browser. Deploy first (Phase 11), gather real feedback from technicians in the field, then add PWA polish based on actual usage.

---

## Phase 11 — Deployment & Go-Live

- Configure production environments on Railway/Render (backend + PostgreSQL) and Vercel (frontend)
- Set up environment variables, secrets management, and production database
- Configure custom domain, SSL certificates, and DNS
- Set up CI/CD pipeline via GitHub Actions (automated build → test → deploy on merge to main)
- Database backup strategy and disaster recovery plan
- Application monitoring and logging (e.g., Sentry for errors, LogTail/Datadog for logs)
- Performance testing and load testing before launch
- Staging environment for pre-production validation
- Create runbooks for common operational tasks (rollback, DB restore, scaling)
- Go-live checklist and launch

**Why Phase 11:** Deployment is the final gate. All features should be stable and tested before pushing to production. A proper deployment phase ensures reliability, observability, and a smooth launch.

---

## MVP Recommendation

Deliver **Phases 1–6** first for a working booking system with a defined team and architecture (~7–8 weeks with AI-assisted development).  
**Phases 7–9** add operational depth, retention, and revenue.  
**Phase 10** operationalizes the field team.  
**Phase 11** takes the product live.  
**Full go-live: ~14–16 weeks (~3.5–4 months) with AI.**

---

## Timeline (AI-Assisted Development)

All estimates assume AI tools (GitHub Copilot, ChatGPT, Cursor) are used throughout every step.

| Phase | Description | Duration | What AI Helps With |
|---|---|---|---|
| Phase 1 | Technology choices | 2–3 days | Compares options, generates rationale docs |
| Phase 2 | Team assembly | 1 week | Can’t speed up hiring |
| Phase 3 | System design & wireframes | 1 week | Generates ER diagrams, API contracts, architecture docs |
| Phase 4 | Foundation & infrastructure | 1.5 weeks | Scaffolds Express app, Prisma schema, JWT auth, GitHub Actions |
| Phase 5 | User & pool management (CRUD) | 1.5 weeks | Generates CRUD endpoints, React components, validation |
| Phase 6 | Appointment scheduling + calendar | 1.5 weeks | Calendar integration, email confirmation, tests (conflict detection skipped) |
| | **MVP Total (Phases 1–6)** | **~7–8 weeks (~2 months)** | |
| Phase 7 | Service photos & history | 1 week | Local storage first, then R2 upload logic, image handling, history queries |
| Phase 8 | Notifications & reminders | 1 week | Twilio/SendGrid integration boilerplate, cron jobs |
| Phase 9 | Invoicing & payments (Stripe) | 2 weeks | Stripe integration, webhook handlers, PDF generation |
| Phase 10 | Mobile/technician PWA | 2 weeks | Service worker setup, responsive components |
| Phase 11 | Deployment & go-live | 1 week | CI/CD configs, Dockerfiles, monitoring setup, runbooks |
| | **Full Product (Phases 1–11)** | **~14–16 weeks (~3.5–4 months)** | |

---

## What AI Cannot Help With

AI accelerates code generation, documentation, and boilerplate — but these areas still require human judgment:

| Area | Why AI Can’t Replace Humans | Impact |
|---|---|---|
| **Hiring & team assembly** | Interviewing, culture fit, and availability are human decisions | Team assembly still takes ~1 week regardless of AI |
| **UX design decisions** | AI can generate wireframes, but understanding how a pool technician actually works in the field requires domain empathy and user research | Bad UX = users won’t adopt the product |
| **Domain knowledge** | AI doesn’t know the pool cleaning industry — seasonal patterns, chemical requirements, route logistics, pricing models | Wrong assumptions → wrong features |
| **Stakeholder alignment** | Getting buy-in, prioritizing features, resolving conflicting requirements — these are conversations, not code | Misalignment causes rework |
| **QA edge cases** | AI writes tests for happy paths well, but finding obscure bugs (double-booking race conditions, timezone edge cases, payment failure scenarios) requires human testing intuition | Missed edge cases = production bugs |
| **Security review** | AI can follow patterns but may miss context-specific vulnerabilities (e.g., business logic flaws, authorization bypasses between roles) | Security gaps can’t be caught by pattern-matching alone |
| **Production monitoring** | AI can set up dashboards, but interpreting alerts, deciding when to scale, and handling incidents requires human judgment | Downtime decisions need context |
| **User feedback & iteration** | AI can’t talk to customers or observe how they struggle with the UI | Building the wrong thing faster is still building the wrong thing |
