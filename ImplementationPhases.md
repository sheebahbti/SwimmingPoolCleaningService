# Swimming Pool Cleaning Service — Implementation Phases

---

## Phase 1 — Choosing Technology

See [TechnologyChoices.md](TechnologyChoices.md) for full technology decisions, rationale, NoSQL comparison, and scaling strategy.

**Summary of choices:** Node.js + Express (TypeScript), PostgreSQL + Prisma, React + Tailwind, Passport.js + JWT, FullCalendar, Nodemailer + Twilio, Stripe, Render.

---

## Phase 2 — Choosing Team

- **Project Manager (1)** — Owns timeline, coordinates across phases, removes blockers
- **Dev Manager (1)** — Technical leadership, code reviews, architecture decisions, mentors developers
- **Full-Stack Developer (2)** — Node.js/Express backend + React frontend; both should be strong in TypeScript
- **UI/UX Designer (1, ~50%)** — Designs customer-facing booking flow, technician mobile views, and admin dashboard
- **QA Engineer (1)** — Manual + automated testing; writes integration tests from Phase 4 onward
- **DevOps / Cloud Engineer (0.5, part-time)** — Sets up CI/CD pipeline, deployment to Render, database backups

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
- Document deployment architecture (Render single-service topology)
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

### What "deployment" means

Right now your app only runs on your laptop — only you can access it at `localhost`.
Deployment puts the code on computers in the cloud that run 24/7, reachable by anyone via a URL.

```
Before deployment (local only):
  Your laptop → backend (port 3000) + frontend (port 5174) + PostgreSQL

After deployment (live on the internet):
  Render (cloud) → Express backend + React frontend + PostgreSQL database → one public URL
  Anyone in the world can use the app
```

### Why one service (not Render + Vercel)?

| Concern | Answer |
|---|---|
| **Don't I need a CDN?** | No — all users are in Dallas. A React SPA is ~500KB and loads in under a second from Render. Add Cloudflare (free) later if expanding beyond Dallas. |
| **Don't I need separate deploys?** | Not at this scale. One git push deploys both frontend and API. Simpler to manage. |
| **What about CORS?** | Not needed. Frontend and API are same-origin (same URL), so no cross-origin issues at all. |
| **What if I need to scale later?** | Split frontend to Vercel/Cloudflare Pages when you expand beyond Dallas or hire a separate frontend team. The code already supports it (`VITE_API_URL` env var). |

### Step-by-step: Deploy to Render

1. Go to **render.app** → **New Project** → **Deploy from GitHub repo**
2. Select `SwimmingPoolCleaningService` — Render will use the `render.toml` config at the repo root
3. In the same project: **+ New** → **Database** → **PostgreSQL**
4. Link the PostgreSQL service to your app service — Render auto-sets `DATABASE_URL` via reference variable `${{Postgres.DATABASE_URL}}`
5. Go to your app service → **Variables** tab → add:
   - `JWT_SECRET` — a strong random string (`openssl rand -hex 32`)
   - `FRONTEND_URL` — your Render public URL (e.g. `https://your-app.up.render.app`)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — email credentials (or skip for now)
   - `STRIPE_SECRET_KEY` — Stripe key (or skip for now)
6. Deploy — Render runs:
   - **Build:** `cd frontend && npm ci && npm run build && cd ../backend && npm ci && npm run build`
   - **Start:** `cd backend && npx prisma migrate deploy && node dist/index.js`
7. Render gives you a public URL like `https://your-app.up.render.app`
8. Seed the database with an initial admin account (run seed script or create manually via Render terminal)

### How the single service works

Express serves both the API and the React frontend from one server:

| Request | What Render Does |
|---|---|
| `GET /` | Serves `frontend/dist/index.html` (React SPA) |
| `GET /assets/main.js` | Serves built JS bundle from `frontend/dist/` |
| `GET /api/pools` | Routes to Express API controller → PostgreSQL → JSON response |
| `GET /dashboard` | Catch-all → serves `index.html` → React Router handles client-side routing |

### What changes between dev and production

| Thing | Development (local) | Production (deployed) |
|---|---|---|
| URL | `http://localhost:3000` (backend) + `http://localhost:5174` (frontend) | `https://your-app.up.render.app` (one URL for everything) |
| API calls | Vite proxy (`/api` → port 3000) | Same-origin (`/api` — no proxy or CORS needed) |
| Database | Local PostgreSQL | Render PostgreSQL (starts empty, migrations run on deploy) |
| File uploads | `backend/uploads/` on your disk | Need Cloudflare R2 (Render disk is ephemeral) |
| TypeScript | Runs directly via ts-node | Compiled to JS first (`tsc`), then `node dist/index.js` |
| Frontend serving | Vite dev server (hot reload) | Express serves built static files from `frontend/dist/` |

### Code changes made for production

- `backend/src/index.ts` — Serves frontend static files from `frontend/dist/` with SPA catch-all route; CORS reads `FRONTEND_URL` env var (fallback for development)
- `frontend/src/lib/api.ts` — API base URL defaults to `/api` (same-origin, works in both dev and production)
- `backend/package.json` — build script runs `prisma generate` before `tsc`
- `render.toml` — Builds both frontend and backend, runs migrations on start, health check at `/api/health`

### Remaining tasks

- Configure Render project with app service + PostgreSQL database
- Set environment variables in Render dashboard
- Seed production database with initial admin account
- Switch file uploads to Cloudflare R2 (local disk doesn't persist on Render)
- Set up CI/CD: auto-deploy on every `git push` to main (Render does this automatically when connected to GitHub)
- Application monitoring: Sentry (errors), Render metrics (CPU/memory)
- Optional: Add Cloudflare (free) in front of Render for CDN + DDoS protection if expanding beyond Dallas

**Why Phase 11:** Deployment is the final gate. All features should be stable and tested before pushing to production.

---

## Phase 12 — Testing & Quality Assurance

### Testing Strategy

A comprehensive testing strategy ensures code quality, catches regressions, and builds confidence for production deployments.

```
Testing Pyramid:
                    ┌─────────────┐
                    │    E2E      │  ← Playwright (critical user flows)
                    │   Tests     │     Slowest, most realistic
                    └──────┬──────┘
                   ┌───────┴───────┐
                   │  Integration  │  ← Supertest (API endpoints)
                   │    Tests      │     Test API + database together
                   └───────┬───────┘
          ┌────────────────┴────────────────┐
          │          Unit Tests             │  ← Jest + React Testing Library
          │  (functions, components, utils) │     Fastest, most granular
          └─────────────────────────────────┘
```

### Testing Tools & Technologies

| Tool | Purpose | Why This Tool |
|---|---|---|
| **Jest** | Unit test runner | De facto standard for JS/TS, fast, built-in mocking, snapshot testing |
| **Supertest** | API integration tests | HTTP assertions for Express, works with Jest, test without running server |
| **React Testing Library** | Component tests | Tests user behavior not implementation, encourages accessible code |
| **Playwright** | E2E browser tests | Cross-browser, auto-wait, network mocking, visual regression, faster than Cypress |
| **MSW (Mock Service Worker)** | API mocking | Intercepts network requests in tests, same mocks work in browser and Node |
| **Faker.js** | Test data generation | Realistic fake data for users, emails, addresses, dates |
| **nyc / c8** | Code coverage | Track which lines are tested, enforce coverage thresholds |

### Backend Tests

#### Unit Tests (Jest)
- **Controllers:** Test business logic with mocked Prisma client
- **Services:** Test utility functions (email formatting, PDF generation, Stripe helpers)
- **Middleware:** Test auth middleware with mocked JWT verification
- **Validators:** Test input validation and error handling

```typescript
// Example: backend/src/controllers/__tests__/auth.controller.test.ts
describe('AuthController', () => {
  describe('login', () => {
    it('returns 401 for invalid credentials', async () => { ... });
    it('returns JWT token for valid credentials', async () => { ... });
    it('returns 400 when email is missing', async () => { ... });
  });
});
```

#### Integration Tests (Supertest + Jest)
- **API Endpoints:** Test full request/response cycle with test database
- **Authentication flows:** Register → Login → Access protected routes
- **Business workflows:** Create user → Add pool → Book appointment → Complete → Invoice

```typescript
// Example: backend/src/routes/__tests__/pool.routes.test.ts
describe('GET /api/pools', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/pools');
    expect(res.status).toBe(401);
  });

  it('returns customer pools when authenticated', async () => {
    const res = await request(app)
      .get('/api/pools')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
```

### Frontend Tests

#### Component Tests (React Testing Library)
- **Forms:** Test validation, submission, error display
- **Lists:** Test filtering, sorting, pagination
- **Auth:** Test login/logout flows, protected route redirects
- **Modals:** Test open/close, form submission, cancel

```typescript
// Example: frontend/src/pages/__tests__/LoginPage.test.tsx
describe('LoginPage', () => {
  it('shows error message for invalid credentials', async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@email.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});
```

#### E2E Tests (Playwright)
- **Critical user journeys:**
  - Customer: Register → Add Pool → Book Appointment → View Invoice → Pay
  - Technician: Login → View Schedule → Start Job → Upload Photos → Complete
  - Admin: Login → Create Technician → Assign Job → Generate Invoice → Mark Paid

```typescript
// Example: e2e/booking-flow.spec.ts
test('customer can book an appointment', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'alice@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await page.goto('/booking');
  await page.click('text=Schedule Service');
  await page.selectOption('[name="poolId"]', { label: 'Main Pool' });
  await page.click('.fc-future'); // Click a future date
  await page.click('text=Confirm Booking');
  
  await expect(page.locator('text=Appointment confirmed')).toBeVisible();
});
```

### Test Configuration Files

| File | Purpose |
|---|---|
| `backend/jest.config.js` | Backend Jest configuration |
| `backend/jest.setup.ts` | Test database setup, global mocks |
| `frontend/vitest.config.ts` | Frontend Vitest configuration (faster than Jest for Vite) |
| `frontend/src/test/setup.ts` | Testing Library setup, MSW handlers |
| `playwright.config.ts` | E2E test configuration, browsers, base URL |
| `.github/workflows/test.yml` | CI pipeline: lint → unit → integration → E2E |

### Test Database Strategy

```
Development DB   →  Your local PostgreSQL (persistent data)
Test DB          →  Separate local DB or in-memory (wiped between test runs)
CI/CD Test DB    →  GitHub Actions service container (PostgreSQL)
```

- Use `DATABASE_URL_TEST` env var for test database
- Run `prisma migrate reset` before each test suite to ensure clean state
- Use transactions with rollback for faster integration tests

### Code Coverage Targets

| Coverage Type | Target | Rationale |
|---|---|---|
| **Statements** | 80% | High enough to catch most issues, not so high it becomes a burden |
| **Branches** | 75% | Ensure conditional logic is tested |
| **Functions** | 85% | All public functions should have tests |
| **Lines** | 80% | Match statement coverage |

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Run backend tests
        run: cd backend && npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run frontend tests
        run: cd frontend && npm test

      - name: Run E2E tests
        run: npx playwright test
```

### What to Test vs. What to Skip

| Test | Skip |
|---|---|
| ✅ Business logic (invoice calculation, role permissions) | ❌ Prisma-generated code |
| ✅ API contracts (request/response shapes) | ❌ Third-party libraries (Stripe SDK internals) |
| ✅ User interactions (forms, navigation) | ❌ CSS styling (use visual regression for critical UI) |
| ✅ Error handling (invalid inputs, network failures) | ❌ Framework boilerplate (React internals) |
| ✅ Authentication & authorization | ❌ Obvious getters/setters |

### Timeline for Testing Phase

| Task | Duration | Dependencies |
|---|---|---|
| Set up Jest + Supertest (backend) | 1 day | None |
| Set up Vitest + RTL (frontend) | 1 day | None |
| Write unit tests (controllers, utils) | 3 days | Jest setup |
| Write integration tests (API endpoints) | 3 days | Test database |
| Set up Playwright | 1 day | None |
| Write E2E tests (critical flows) | 3 days | Playwright setup |
| CI/CD pipeline integration | 1 day | All tests passing locally |
| **Total** | **~2 weeks** | |

**Why Phase 12:** Testing should happen throughout development, but a dedicated phase ensures comprehensive coverage before launch. Catches regressions, documents expected behavior, and enables confident refactoring.

---

## MVP Recommendation

Deliver **Phases 1–6** first for a working booking system with a defined team and architecture (~7–8 weeks with AI-assisted development).  
**Phases 7–9** add operational depth, retention, and revenue.  
**Phase 10** operationalizes the field team.  
**Phase 11** takes the product live.  
**Phase 12** ensures quality with comprehensive testing.  
**Full go-live: ~16–18 weeks (~4–4.5 months) with AI.**

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
| Phase 12 | Testing & QA | 2 weeks | Test scaffolding, mock generation, test data factories |
| | **Full Product (Phases 1–12)** | **~16–18 weeks (~4–4.5 months)** | |

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
