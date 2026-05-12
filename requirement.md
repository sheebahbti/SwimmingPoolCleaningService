# Swimming Pool Cleaning Service — Project Requirements

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | Node.js + Express | Async I/O, single language, huge ecosystem |
| Database | PostgreSQL + Prisma | Relational data, ACID compliance, date/time support |
| Auth | JWT + bcrypt | Stateless sessions, secure password hashing |
| Email | Nodemailer + SendGrid | Reliable delivery, free tier, analytics |
| Payments | Stripe | PCI compliant, best developer experience |
| File Storage | Azure Blob Storage | Photo uploads, integrates natively with Azure hosting |
| Hosting | Azure App Service | Managed hosting, auto-scaling, custom domain, SSL |
| Database Hosting | Azure Database for PostgreSQL | Managed PostgreSQL, built-in backups, same Azure ecosystem |

---

## Phase 1: Project Setup

- Initialize Node.js project (`npm init`)
- Install core dependencies: `express`, `prisma`, `dotenv`, `bcrypt`, `jsonwebtoken`
- Set up PostgreSQL database locally for development
- Provision **Azure Database for PostgreSQL** for production
- Define Prisma schema (Users, Schedules, Payments, Photos)
- Run initial database migration (`npx prisma migrate dev`)
- Set up `.env` file for all secrets (DB connection string, JWT, Azure keys, Stripe)
- Set up project folder structure
- Create Azure Storage Account and Blob container for photos

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
- Tools: `Nodemailer` + `SendGrid` for email delivery
- Scheduler: `node-cron` or `BullMQ` for timed reminders

---

## Phase 5: Email Service with Photo Uploads

- Cleaner uploads "before" photo at job start
- Cleaner uploads "after" photo at job completion
- Photos stored in **Azure Blob Storage** (`@azure/storage-blob`)
- Generate SAS (Shared Access Signature) URL for secure direct uploads from browser
- Blob URLs saved in the database against the job record
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

- **Azure Database for PostgreSQL** provides automated backups by default (7–35 day retention)
- Enable geo-redundant backup in Azure portal for disaster recovery
- Store additional manual backups in **Azure Blob Storage** (separate container)
- Test restore process via Azure portal before going live

---

## Phase 9: Deployment

- Containerize app with Docker
- Deploy backend to **Azure App Service** (Node.js runtime, managed SSL, auto-scaling)
- Deploy frontend (React) to **Azure Static Web Apps** (free tier, CDN included)
- Use **Azure Database for PostgreSQL** for production DB
- Use **Azure Blob Storage** for photo storage
- Store all secrets in **Azure Key Vault** or App Service environment variables — never hardcode
- Set up custom domain with HTTPS (free managed SSL certificate via Azure)
- Set up CI/CD pipeline with **GitHub Actions → Azure App Service** (auto-deploy on push to `main`)

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
