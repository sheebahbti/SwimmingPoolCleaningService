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

### Invoices (later)

| Method | Route | What It Does |
|--------|-------|--------------|
| POST | `/api/invoices` | Generate invoice for completed service |
| GET | `/api/invoices?customerId=1` | Customer's invoices |
| PUT | `/api/invoices/:id/pay` | Mark as paid |

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
