# Database Schema & API Design

---

## Database Tables

### Users

| Column | Type | Notes |
|--------|------|-------|
| id | Int (PK) | Auto-increment |
| email | String | Unique |
| name | String | |
| phone | String | |
| role | Enum | ADMIN, TECHNICIAN, CUSTOMER |
| password | String | Hashed |
| createdAt | DateTime | Auto |

---

### Pools

| Column | Type | Notes |
|--------|------|-------|
| id | Int (PK) | Auto-increment |
| customerId | Int (FK) | → Users.id |
| address | String | Pool location |
| size | String | Small, Medium, Large |
| type | String | In-ground, Above-ground |
| notes | String? | Optional — gate code, dog, etc. |

---

### Schedules

| Column | Type | Notes |
|--------|------|-------|
| id | Int (PK) | Auto-increment |
| customerId | Int (FK) | → Users.id |
| technicianId | Int (FK) | → Users.id |
| poolId | Int (FK) | → Pools.id |
| date | DateTime | Appointment date/time |
| status | Enum | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED |
| notes | String? | Optional |
| createdAt | DateTime | Auto |

---

### MaintenanceRecords

| Column | Type | Notes |
|--------|------|-------|
| id | Int (PK) | Auto-increment |
| scheduleId | Int (FK) | → Schedules.id |
| workDone | String | Description of service |
| chemicalsUsed | String? | Optional |
| photoBeforeUrl | String? | File URL (local disk in dev, R2 in production) |
| photoAfterUrl | String? | File URL (local disk in dev, R2 in production) |
| completedAt | DateTime | |

---

### Invoices

| Column | Type | Notes |
|--------|------|-------|
| id | Int (PK) | Auto-increment |
| scheduleId | Int (FK) | → Schedules.id |
| amount | Decimal | |
| status | Enum | PENDING, PAID, OVERDUE |
| dueDate | DateTime | |
| paidAt | DateTime? | Null until paid |
| stripePaymentIntentId | String? | Stripe PaymentIntent ID (set on payment) |

---

## Entity-Relationship Diagram (ERD)

```
              ┌───────────┐
              │   Users   │
              └─────┬─────┘
                    │
        ┌───────────┼───────────┐
        │ 1:many    │           │ 1:many
        │    (CUSTOMER)         │  (TECHNICIAN)
        ▼           ▼           │
  ┌──────────┐  ┌──────────┐   │
  │  Pools   │  │Schedules │◄──┘
  └────┬─────┘  └────┬──┬──┘
       │   1:many     │  │
       └──────────────┘  │
                   ┌─────┼─────┐
                   │ 1:1       │ 1:1
                   ▼           ▼
         ┌──────────────┐  ┌──────────┐
         │ Maintenance  │  │ Invoices │
         │   Records    │  │          │
         └──────────────┘  └──────────┘
```

### Summary

```
Users (CUSTOMER)    ──1:many──→  Pools
Users (CUSTOMER)    ──1:many──→  Schedules
Users (TECHNICIAN)  ──1:many──→  Schedules
Pools               ──1:many──→  Schedules
Schedules           ──1:1────→  MaintenanceRecords
Schedules           ──1:1────→  Invoices
```

---

## API Endpoints

### Building Now

| Method | Route | What It Does |
|--------|-------|---------------|
| GET | `/api/technicians` | List all technicians (name, phone, email) |
| POST | `/api/schedules` | Pick a technician + customer + date → create schedule → sends email notification |

### Schedules (later)

| Method | Route | What It Does |
|--------|-------|--------------|
| GET | `/api/schedules` | List all schedules (with filters) |
| GET | `/api/schedules/:id` | Get one schedule |
| PUT | `/api/schedules/:id` | Update a schedule |
| DELETE | `/api/schedules/:id` | Cancel a schedule |

### Users (later)

| Method | Route | What It Does |
|--------|-------|--------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/users` | List all users (admin only) |
| GET | `/api/users/:id` | Get user profile |

### Pools (later)

| Method | Route | What It Does |
|--------|-------|--------------|
| POST | `/api/pools` | Add a pool to a customer |
| GET | `/api/pools?customerId=1` | Get customer's pools |
| PUT | `/api/pools/:id` | Update pool details |

### Maintenance Records (later)

| Method | Route | What It Does |
|--------|-------|--------------|
| POST | `/api/maintenance` | Log work done after appointment |
| GET | `/api/maintenance?scheduleId=1` | Get record for a schedule |

### File Uploads

| Method | Route | What It Does |
|--------|-------|--------------|
| POST | `/api/uploads` | Upload a photo (multipart/form-data via multer) → returns file URL |
| GET | `/uploads/:filename` | Serve uploaded file (handled by express.static, no controller needed) |

**Upload flow:**
```
1. Frontend: FormData with file → POST /api/uploads
2. Backend: multer parses file → saves to uploads/ folder → returns { url }
3. Frontend: Includes URL in POST /api/maintenance body
4. Backend: Saves URL to MaintenanceRecord.photoBeforeUrl / photoAfterUrl
5. Frontend: <img src={url}> → express.static serves file from disk
```

### Invoices

| Method | Route | What It Does |
|--------|-------|--------------|
| GET | `/api/invoices` | List invoices (admin: all, customer: own) |
| GET | `/api/invoices/:id` | Get single invoice with schedule details |
| GET | `/api/invoices/:id/pdf` | Download invoice as PDF |
| POST | `/api/invoices` | Create invoice (admin only) |
| POST | `/api/invoices/:id/pay` | Initiate Stripe payment (customer) |
| POST | `/api/invoices/:id/confirm` | Confirm payment after Stripe (customer) |
| PATCH | `/api/invoices/:id/status` | Update invoice status (admin) |

**Auto-generation:** When a technician creates a maintenance record, the system auto-generates an invoice ($150 default, 14-day due date) and marks the schedule COMPLETED.

**Payment flow:**
```
1. Customer clicks "Pay" → POST /api/invoices/:id/pay
2. Backend creates Stripe PaymentIntent → returns clientSecret
3. Frontend uses Stripe.js to confirm payment with card details
4. Customer confirms → POST /api/invoices/:id/confirm
5. Backend verifies PaymentIntent status → marks invoice PAID
```

---

## POST /api/schedules — Detail

**Request:**
```json
{
  "customerId": 1,
  "technicianId": 2,
  "poolId": 1,
  "date": "2026-06-15T09:00:00Z",
  "notes": "Monthly cleaning"
}
```

**Response (201):**
```json
{
  "id": 1,
  "customerId": 1,
  "technicianId": 2,
  "poolId": 1,
  "date": "2026-06-15T09:00:00Z",
  "status": "SCHEDULED",
  "notes": "Monthly cleaning",
  "createdAt": "2026-05-12T10:00:00Z"
}
```

**Side effect:** Sends email to customer confirming the appointment.

---

## Sample Data

This section shows example data for each table, demonstrating relationships and how image URLs are stored.

### Users Table

| id | email | name | phone | role | password | createdAt |
|----|-------|------|-------|------|----------|-----------|
| 1 | admin@poolservice.com | Sarah Johnson | 214-555-0100 | ADMIN | $2b$10$xK8...hashed | 2026-01-15 08:00:00 |
| 2 | bob@poolservice.com | Bob Martinez | 214-555-0201 | TECHNICIAN | $2b$10$yL9...hashed | 2026-01-20 09:00:00 |
| 3 | mike@poolservice.com | Mike Chen | 214-555-0202 | TECHNICIAN | $2b$10$zM0...hashed | 2026-02-01 10:00:00 |
| 4 | alice@example.com | Alice Thompson | 972-555-1234 | CUSTOMER | $2b$10$aB1...hashed | 2026-03-01 14:30:00 |
| 5 | david@example.com | David Wilson | 469-555-5678 | CUSTOMER | $2b$10$cD2...hashed | 2026-03-15 11:00:00 |
| 6 | emma@example.com | Emma Rodriguez | 817-555-9012 | CUSTOMER | $2b$10$eF3...hashed | 2026-04-01 16:45:00 |

**Notes:**
- Passwords shown are bcrypt hashes (actual values: `swim@876` for all demo accounts)
- Admin (id=1) manages the business
- Technicians (id=2,3) perform pool cleaning services
- Customers (id=4,5,6) own pools and book services

---

### Pools Table

| id | customerId | address | size | type | notes |
|----|------------|---------|------|------|-------|
| 1 | 4 | 1234 Oak Lane, Dallas, TX 75201 | Large | In-ground | Gate code: 4521. Friendly dog in backyard. |
| 2 | 4 | 5678 Maple Ave, Dallas, TX 75202 | Medium | In-ground | Rental property. Contact tenant before arrival. |
| 3 | 5 | 910 Cedar Drive, Plano, TX 75023 | Large | In-ground | Hot tub attached. Check chemical levels carefully. |
| 4 | 6 | 2468 Elm Street, Fort Worth, TX 76102 | Small | Above-ground | Pool cover stored in shed. |
| 5 | 6 | 1357 Pine Road, Arlington, TX 76010 | Medium | In-ground | Solar cover - remove before cleaning. |

**Notes:**
- Alice (customer 4) owns 2 pools (primary residence + rental)
- David (customer 5) owns 1 large pool with hot tub
- Emma (customer 6) owns 2 pools at different properties

---

### Schedules Table

| id | customerId | technicianId | poolId | date | status | notes | createdAt |
|----|------------|--------------|--------|------|--------|-------|-----------|
| 1 | 4 | 2 | 1 | 2026-05-10 09:00:00 | COMPLETED | Weekly maintenance | 2026-05-01 10:00:00 |
| 2 | 4 | 2 | 1 | 2026-05-17 09:00:00 | COMPLETED | Weekly maintenance | 2026-05-01 10:05:00 |
| 3 | 4 | 3 | 2 | 2026-05-12 14:00:00 | COMPLETED | Monthly deep clean | 2026-05-05 08:30:00 |
| 4 | 5 | 2 | 3 | 2026-05-14 10:00:00 | COMPLETED | Bi-weekly service + hot tub | 2026-05-07 11:00:00 |
| 5 | 6 | 3 | 4 | 2026-05-15 08:00:00 | IN_PROGRESS | Opening pool for summer | 2026-05-08 09:15:00 |
| 6 | 6 | 2 | 5 | 2026-05-20 11:00:00 | SCHEDULED | Regular cleaning | 2026-05-10 14:00:00 |
| 7 | 4 | 2 | 1 | 2026-05-24 09:00:00 | SCHEDULED | Weekly maintenance | 2026-05-10 14:30:00 |
| 8 | 5 | 3 | 3 | 2026-05-28 10:00:00 | SCHEDULED | Bi-weekly service | 2026-05-12 10:00:00 |

**Notes:**
- Schedules 1-4: Completed with maintenance records and invoices
- Schedule 5: Currently in progress (technician on-site)
- Schedules 6-8: Future appointments

---

### MaintenanceRecords Table

| id | scheduleId | workDone | chemicalsUsed | photoBeforeUrl | photoAfterUrl | completedAt |
|----|------------|----------|---------------|----------------|---------------|-------------|
| 1 | 1 | Skimmed surface, vacuumed floor, brushed walls, cleaned filter basket, tested and balanced chemicals | Chlorine 2lbs, pH Up 8oz | `/uploads/pool-1-before-20260510.jpg` | `/uploads/pool-1-after-20260510.jpg` | 2026-05-10 10:30:00 |
| 2 | 2 | Standard weekly cleaning, adjusted chlorine levels, cleared debris from skimmer | Chlorine 1.5lbs | `/uploads/pool-1-before-20260517.jpg` | `/uploads/pool-1-after-20260517.jpg` | 2026-05-17 10:15:00 |
| 3 | 3 | Deep clean - drained partially, acid washed tiles, replaced filter cartridge, refilled and balanced | Muriatic acid 1gal, Chlorine 3lbs, Stabilizer 2lbs | `/uploads/pool-2-before-20260512.jpg` | `/uploads/pool-2-after-20260512.jpg` | 2026-05-12 17:00:00 |
| 4 | 4 | Pool and hot tub service, cleaned both filters, balanced chemicals for both, checked hot tub jets | Chlorine 2lbs, Bromine tablets 4, pH Down 4oz | `/uploads/pool-3-before-20260514.jpg` | `/uploads/pool-3-after-20260514.jpg` | 2026-05-14 12:30:00 |

**Image URL Storage Patterns:**

| Environment | URL Pattern | Example |
|-------------|-------------|---------|
| **Development (Local Disk)** | `/uploads/{filename}` | `/uploads/pool-1-before-20260510.jpg` |
| **Production (Cloudflare R2)** | `https://{bucket}.r2.cloudflarestorage.com/{filename}` | `https://poolservice-photos.r2.cloudflarestorage.com/pool-1-before-20260510.jpg` |
| **Production (with CDN)** | `https://cdn.poolservice.com/photos/{filename}` | `https://cdn.poolservice.com/photos/pool-1-before-20260510.jpg` |

**Image Naming Convention:**
```
{pool-id}-{before|after}-{YYYYMMDD}-{uuid}.{ext}

Examples:
- pool-1-before-20260510-a1b2c3d4.jpg
- pool-1-after-20260510-e5f6g7h8.jpg
- pool-3-before-20260514-i9j0k1l2.png
```

---

### Invoices Table

| id | scheduleId | amount | status | dueDate | paidAt | stripePaymentIntentId |
|----|------------|--------|--------|---------|--------|----------------------|
| 1 | 1 | 150.00 | PAID | 2026-05-24 | 2026-05-12 14:30:00 | pi_3PxYz123abc456def |
| 2 | 2 | 150.00 | PAID | 2026-05-31 | 2026-05-20 09:15:00 | pi_3PxYz789ghi012jkl |
| 3 | 3 | 350.00 | PAID | 2026-05-26 | 2026-05-15 16:00:00 | pi_3PxYz345mno678pqr |
| 4 | 4 | 200.00 | PENDING | 2026-05-28 | NULL | NULL |

**Notes:**
- Invoice 1-3: Paid via Stripe (PaymentIntent IDs stored for reference)
- Invoice 4: Pending payment, due in 14 days from service
- Invoice 3 has higher amount ($350) for deep cleaning service
- Invoice 4 has $200 for pool + hot tub combo service

---

### Complete Data Flow Example

Here's how a single appointment flows through all tables:

```
1. CUSTOMER Alice (id=4) books cleaning for Pool at 1234 Oak Lane (pool_id=1)
   → Schedule created (id=1, status=SCHEDULED)

2. TECHNICIAN Bob (id=2) arrives, takes BEFORE photo
   → Photo uploaded: /uploads/pool-1-before-20260510.jpg

3. Bob completes work, takes AFTER photo
   → Photo uploaded: /uploads/pool-1-after-20260510.jpg
   → MaintenanceRecord created with both URLs
   → Schedule status → COMPLETED
   → Invoice auto-generated ($150, due 2026-05-24)

4. Alice receives invoice email, clicks "Pay Now"
   → Stripe PaymentIntent created
   → Alice enters card details
   → Payment confirmed
   → Invoice status → PAID
   → stripePaymentIntentId stored
```

### Sample API Response with Images

**GET /api/maintenance/1**
```json
{
  "id": 1,
  "scheduleId": 1,
  "workDone": "Skimmed surface, vacuumed floor, brushed walls, cleaned filter basket, tested and balanced chemicals",
  "chemicalsUsed": "Chlorine 2lbs, pH Up 8oz",
  "photoBeforeUrl": "/uploads/pool-1-before-20260510.jpg",
  "photoAfterUrl": "/uploads/pool-1-after-20260510.jpg",
  "completedAt": "2026-05-10T10:30:00.000Z",
  "schedule": {
    "id": 1,
    "date": "2026-05-10T09:00:00.000Z",
    "status": "COMPLETED",
    "pool": {
      "address": "1234 Oak Lane, Dallas, TX 75201"
    },
    "customer": {
      "name": "Alice Thompson",
      "email": "alice@example.com"
    },
    "technician": {
      "name": "Bob Martinez"
    }
  }
}
```

### Frontend Image Display

```tsx
// How images are displayed in the frontend
<div className="grid grid-cols-2 gap-4">
  <div>
    <h4>Before</h4>
    <img 
      src={`${API_BASE_URL}${record.photoBeforeUrl}`} 
      alt="Pool before cleaning"
      // Development: http://localhost:3000/uploads/pool-1-before-20260510.jpg
      // Production: https://poolservice.onrender.com/uploads/pool-1-before-20260510.jpg
    />
  </div>
  <div>
    <h4>After</h4>
    <img 
      src={`${API_BASE_URL}${record.photoAfterUrl}`} 
      alt="Pool after cleaning"
    />
  </div>
</div>
```
