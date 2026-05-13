# Swimming Pool Cleaning Service — Project Requirements

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | Node.js + Express | Async I/O, single language, huge ecosystem |
| Database | PostgreSQL + Prisma | Relational data, ACID compliance, date/time support |
| Auth | JWT + bcrypt | Stateless sessions, secure password hashing |
| Email | Nodemailer + Mailtrap (testing) / SendGrid (production) | Test emails safely, reliable delivery |
| Payments | Stripe | PCI compliant, best developer experience |
| File Storage | Local disk (dev) / Cloudflare R2 (production) | $0 egress, free tier never expires, S3-compatible |
| Hosting | Railway (backend) / Vercel (frontend) | Free tier, auto-deploy from GitHub |
| Database Hosting | Railway PostgreSQL | Co-located with backend, low latency |

---

## Phase 1: Project Setup

- Initialize Node.js project (`npm init`)
- Install core dependencies: `express`, `prisma`, `dotenv`, `bcrypt`, `jsonwebtoken`
- Set up PostgreSQL database locally for development
- Provision **Railway PostgreSQL** for production
- Define Prisma schema (Users, Schedules, Payments, Photos)
- Run initial database migration (`npx prisma migrate dev`)
- Set up `.env` file for all secrets (DB connection string, JWT, R2 keys, Stripe)
- Set up project folder structure
- Local disk storage for photos (development), Cloudflare R2 (production)

---

## Phase 2: Authentication & Authorization

- Register endpoint for Users and Cleaners
  - Hash password with `bcrypt` before saving
- Login endpoint
  - Compare password with `bcrypt`
  - Return signed JWT token on success
- Auth middleware
  - Verify JWT on protected routes
  - Attach `userId` and `role` to request
- Role-based access control
  - Roles: `admin`, `cleaner`, `customer`
  - Restrict routes based on role

### Post-Login Customer Flow

After a customer logs in, the app checks for existing schedules:

```
Customer logs in
    ↓
App calls GET /api/schedules?userId={id}
    ↓
┌─────────────────────────────────────┐
│ Has existing schedule(s)?           │
├─────────────────────────────────────┤
│ YES → Show Schedule Dashboard       │
│       (upcoming jobs, status, etc.) │
│       + option to book again        │
├─────────────────────────────────────┤
│ NO  → Show List of Cleaners         │
│       (first-time booking flow)     │
└─────────────────────────────────────┘
```

- API: `GET /api/schedules/mine` — returns schedules for the logged-in customer
- API: `GET /api/cleaners` — returns all users with `role = 'cleaner'`
- Frontend logic: if schedule list is empty → redirect to cleaner selection page
- Cleaner list shows: name, profile photo, availability, rating (if added later)

---

## Phase 3: Scheduling

### Booking Flow (Customer)
1. Customer logs in → app checks for existing schedules (`GET /api/schedules/mine`)
2. **First-time** → show cleaner list (`GET /api/cleaners`), customer picks a cleaner
3. Customer selects date/time → submits booking (`POST /api/schedules`)
4. **Returning** → show Schedule Dashboard with existing bookings
5. Customer can book again → returns to cleaner selection

### API Endpoints
- `GET /api/cleaners` — list all available cleaners (role = cleaner)
- `GET /api/schedules/mine` — get logged-in customer's schedules
- `POST /api/schedules` — create a new booking (cleaner + date/time)
- `PATCH /api/schedules/:id/status` — update job status
- `GET /api/schedules` — admin: list all schedules

### Business Rules
- Update job status: `pending` → `in-progress` → `completed`
- Validate date/time conflicts for cleaner assignments
- Customer cannot book the same cleaner at an overlapping time

---

## Phase 4: Notifications

- Email notification when a service is created (confirmation to customer)
- Reminder email before service starts (30 minutes before via cron job)
- Notification when service is started
- Notification when service is completed
- Tools: `Nodemailer` + `Mailtrap` (testing) / `SendGrid` (production) for email delivery
- Scheduler: `node-cron` or `BullMQ` for timed reminders

---

## Phase 5: Email Service with Photo Uploads

- Cleaner uploads "before" photo at job start
- Cleaner uploads "after" photo at job completion
- **Development:** Photos stored locally in `backend/uploads/` folder
- **Production:** Photos stored in **Cloudflare R2** (`@aws-sdk/client-s3` — S3-compatible)
- Generate pre-signed URL for secure direct uploads from browser
- R2/local URLs saved in the database against the job record
- Completion email sent to customer with before/after photos embedded in HTML

---

## Phase 6: Payment Processing

- Integrate Stripe for card payments
- Customer provides payment method at booking
- Capture payment on job completion
- Handle Stripe webhooks (`payment_intent.succeeded`)
- Mark schedule as paid in database on webhook confirmation
- Store payment records (amount, status, stripePaymentId)
- Support refunds via Stripe API

---

## Phase 7: Admin Dashboard

- View all jobs (filter by status, date, cleaner)
- View all users and cleaners
- Assign / reassign cleaners to jobs
- View all payments and revenue
- Analytics: jobs completed, total revenue, active cleaners

---

## Phase 8: Data Backups

- **Railway PostgreSQL** provides automated daily snapshots (7-day retention)
- For additional backups, use `pg_dump` and store in Cloudflare R2
- Test restore process before going live

---

## Phase 9: Deployment

- Deploy backend to **Railway** (Node.js runtime, managed SSL, auto-deploy)
- Deploy frontend (React) to **Vercel** (free tier, CDN included)
- Use **Railway PostgreSQL** for production DB
- Use **Cloudflare R2** for photo storage (local disk for development)
- Store all secrets in Railway/Vercel environment variables — never hardcode
- Set up custom domain with HTTPS (free SSL from Railway/Vercel)
- Set up CI/CD pipeline with **GitHub → Railway/Vercel** (auto-deploy on push to `main`)

---

## Suggested Build Order

```
1. DB schema + Prisma models
2. Auth (register / login / roles)
3. Scheduling API
4. Notifications (email first, then cron reminders)
5. Photo upload + completion email
6. Payments (Stripe)
7. Admin dashboard (frontend)
8. Data backups
9. Deployment + custom domain
```
