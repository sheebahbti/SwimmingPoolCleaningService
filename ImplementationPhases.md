# Swimming Pool Cleaning Service — Implementation Phases

---

## Phase 1 — Choosing Technology

| Layer | Technology | Reasoning |
|---|---|---|
| **Backend API** | Node.js + Express (TypeScript) | This is a CRUD/scheduling app — Express is lightweight, fast to develop. TypeScript on both frontend and backend means one language across the whole stack, reducing context-switching. |
| **Database** | PostgreSQL + Prisma | Relational data (customers → pools → appointments → maintenance records) is a perfect fit for PostgreSQL. Prisma provides auto-generated types, type-safe queries, and painless migrations — ideal for a TypeScript stack. |
| **Frontend** | React + TypeScript + Tailwind CSS | Component-based for reusable forms/tables; TypeScript catches contract mismatches with the API early; Tailwind speeds up scheduling UI |
| **Auth** | Passport.js + JWT | Lightweight, well-documented, no vendor lock-in. For a service business app with a small user base (admins + technicians + customers), this is the right level of complexity. |
| **Calendar UI** | FullCalendar (React) | Purpose-built for scheduling; drag-and-drop rescheduling out of the box |
| **Email/SMS Notifications** | Nodemailer (email) + Twilio (SMS) | Nodemailer is free for SMTP-based email (or pair with SendGrid). Twilio handles SMS reminders. Both have excellent Node.js SDKs. |
| **Payments** | Stripe | Industry standard, excellent sandbox, webhooks for payment confirmation, great Node.js SDK |
| **Deployment** | Vercel (frontend) + Railway or Render (backend + PostgreSQL) | Simpler and cheaper than Azure/AWS for a small business app. Vercel has first-class React support. Railway/Render offer managed PostgreSQL with free tiers and zero-config deploys from GitHub. |

### Why Node.js over ASP.NET Core for this project?

1. **Scope** — This is a scheduling/CRUD app, not an enterprise system. Express keeps things lean.
2. **One language** — TypeScript end-to-end means shared validation schemas, shared types, less mental overhead.
3. **Ecosystem** — npm has purpose-built packages for every feature listed (scheduling, PDF invoices, email, payments).
4. **Deployment cost** — Node.js apps deploy cheaply on Railway/Render/Vercel. Azure App Service is more expensive for what you need.
5. **Speed of development** — Faster iteration for a small team building an MVP.

---

## Phase 2 — Choosing Team

- **Project Manager (1)** — Owns timeline, coordinates across phases, removes blockers
- **Full-Stack Developer (2)** — Node.js/Express backend + React frontend; both should be strong in TypeScript
- **UI/UX Designer (1)** — Designs customer-facing booking flow, technician mobile views, and admin dashboard
- **QA Engineer (1)** — Manual + automated testing; writes integration tests from Phase 4 onward
- **DevOps / Cloud Engineer (0.5, part-time)** — Sets up CI/CD pipeline, deployment to Railway/Vercel, database backups

### Team Notes

- For an MVP, a **lean team of 3–4** (PM + 2 devs + part-time designer) can cover Phases 1–5.
- Scale up QA and DevOps as the product matures into Phases 6–9.
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

## Phase 5 — Customer & Pool Management

- CRUD endpoints for customers (name, contact, address)
- Each customer can have one or more `Pool` records (size, type, location notes)
- React pages: customer list, customer detail/edit, add pool

**Why Phase 5:** Customers are the root entity — appointments and maintenance records all hang off them.

---

## Phase 6 — Appointment Scheduling

- Endpoints to create/update/cancel appointments; assign a technician; set status (`Scheduled`, `InProgress`, `Completed`, `Cancelled`)
- FullCalendar view showing all appointments by day/week
- Conflict detection (prevent double-booking a technician)
- Email confirmation via SendGrid on booking

**Why Phase 6:** Core value of the service; requires customers and technicians to already exist.

---

## Phase 7 — Service Photos & History

- After an appointment is marked `Completed`, technicians upload before and after photos of the pool
- Customer-facing history view ("your last 5 services")
- Alerts when a pool is overdue for service

**Why Phase 7:** Depends on completed appointments; drives customer retention and trust.

---

## Phase 8 — Notifications & Reminders

- Automated 24-hour appointment reminders (email + optional SMS via Twilio)
- Technician daily schedule summary email
- Re-engagement emails for customers with no appointment in 30+ days

**Why Phase 8:** Requires the scheduling and customer modules to be stable before automating on top of them.

---

## Phase 9 — Invoicing & Payments

- Generate invoices on appointment completion
- Stripe integration for online payment (credit card, ACH)
- Invoice PDF generation (via PDFKit or similar)
- Payment status tracking; overdue reminders

**Why Phase 9:** Revenue-critical but can be done manually (cash/check) initially while earlier phases are validated.

---

## Phase 10 — Mobile / Field Technician PWA

- Progressive Web App view optimized for phones
- Technicians can: view their daily route, mark appointments in progress/complete, log maintenance records from the job site
- Offline-capable with service worker caching

**Why Phase 10:** Nice-to-have for field operations; all data structures are already in place by this point, so it's mostly a UI layer.

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

Deliver **Phases 1–6** first for a working booking system with a defined team and architecture.  
**Phases 7–9** add operational depth, retention, and revenue.  
**Phase 10** operationalizes the field team.  
**Phase 11** takes the product live.
