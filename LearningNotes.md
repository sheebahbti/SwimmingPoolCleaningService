# Learning Notes

## Build Order — Design First, Then Code

1. **Design database tables** — decide what data you store (Users, Pools, Schedules, etc.)
2. **Draw Entity-Relationship Diagram (ERD)** — map how tables connect (1:many, 1:1)
3. **Design API endpoints** — decide what routes exist and what data they accept/return
4. **Set up backend infrastructure** — install packages, configure TypeScript, create Express server
5. **Build** — write the actual code

> Always design before you code. For a large project (20+ tables), skipping design leads to painful rework. For a small project (3 tables), you can sketch it quickly — but still do it.

### What "Set Up Backend" Means

Three things to do before writing any feature code:

1. **Install packages** (`npm install express prisma typescript...`) — download the tools into your project
2. **Configure TypeScript** (`tsconfig.json`) — tell TypeScript how strict to be, where to find files
3. **Create entry point** (`src/index.ts`) — a "hello world" Express server that starts and responds to `GET /`

Once `npm run dev` shows "Server is running" at `http://localhost:3000`, the backend setup is done.

---

## Core Concepts

### TypeScript
- JavaScript with **types**
- Catches errors **before** your code runs
- You define what shape your data should have

```ts
let name: string = "Alice"; // must be a string
name = 42; // Error! TypeScript catches this at compile time
```

---

### Express
- A **framework** that runs on Node.js (JavaScript)
- Lets you build web servers and APIs
- Handles HTTP requests (GET, POST, etc.) and sends responses

```js
app.get('/users', (req, res) => {
  res.json({ name: 'Alice' });
});
```

---

### Prisma
- Lets you talk to your database using code instead of raw SQL
- You define your data models in a schema file
- Generates a **type-safe client** to query your database

```prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String
  email String @unique
}
```

```ts
const users = await prisma.user.findMany();
```

---

### Together
| Tool | Role |
|------|------|
| **Express** | API server — handles HTTP requests |
| **TypeScript** | Makes code safer with types |
| **Prisma** | Reads/writes data from your database |

---

## Web Server vs App Server

| | Web Server | App Server |
|---|---|---|
| Serves | Static files (HTML, CSS, images) | Dynamic content |
| Has logic? | No | Yes |
| Talks to DB? | No | Yes |
| Examples | Nginx, Apache | Express, Django, Spring Boot |

> In practice, Express can act as **both** — it can serve static files and run logic.

---

## Why Separate Frontend and Backend Servers?

| | Backend (port 3000) | Frontend (port 5173) |
|---|---|---|
| **Built with** | Express (Node.js) | Vite (React) |
| **Serves** | JSON data via API endpoints | HTML, CSS, JS (the UI) |
| **Example response** | `{ "id": 1, "status": "SCHEDULED" }` | The actual webpage you see |
| **Runs** | Node.js runtime | Vite dev server (hot reload) |

### Why not one server?

1. **Different jobs** — Express handles business logic (auth, database queries, file uploads). Vite handles compiling React/TypeScript/Tailwind into browser-ready files with instant hot reload.

2. **Independent scaling** — In production, Express serves both the API and the built React static files from a single Render service. For a local Dallas business, this is simpler and sufficient. If expanding beyond Dallas later, the frontend can be split to a CDN (Cloudflare, free tier).

3. **Development speed** — Vite gives instant hot module replacement (change a component → browser updates in milliseconds). Express restarts the whole Node process via nodemon. Mixing them would slow down frontend development.

### How they talk to each other (development)

```
Browser (port 5173) → GET /api/schedules → Vite proxy → Backend (port 3000) → PostgreSQL
```

The Vite proxy in `vite.config.ts` forwards any `/api` or `/uploads` request to port 3000, so the browser thinks it's all one server.

### In production, there's no Vite server

You run `npm run build` → Vite outputs static files → Express serves them via `express.static`. The same Express server handles both the API routes and the frontend static files from a single Render service.

---

## Language vs Framework

| Language | What it does | Framework | What it does |
|----------|-------------|-----------|-------------|
| JavaScript (Node.js) | Runs JS outside the browser | **Express** | Handles HTTP requests/routes |
| Python | General purpose scripting | **Flask / FastAPI** | Handles HTTP requests/routes |
| Java | Strongly typed, enterprise language | **Spring Boot** | Handles HTTP requests/routes |
| C# | Microsoft's typed language | **ASP.NET Core** | Handles HTTP requests/routes |

**Simple rule:**
- **Language** = the tool you write code in
- **Framework** = pre-built code in that language that saves you from building everything from scratch

---

## What is an "Enterprise Language"?

Java is called "enterprise" because:
- Used for **decades** in banks, hospitals, and large corporations
- **Verbose and strict** — more rules, more structure (good for large teams)
- Massive ecosystem of tools built for **scalability and reliability**

> It just means: *"This language is popular in serious, large-scale business software"*

Python and JavaScript are catching up, but Java still dominates in banking and finance.

---

## Windows → Ubuntu Migration Notes

### What to Check When Moving a Node.js Project from Windows to Ubuntu

1. **Line endings** — Windows uses CRLF (`\r\n`), Linux uses LF (`\n`). Add `.gitattributes` with `* text=auto eol=lf` to normalize. Verify with: `git grep -rlI $'\r'`
2. **File permissions** — Linux cares about file permissions (644 for files, 755 for dirs). Windows doesn't. Check with `stat -c "%a %n" <file>`.
3. **Case sensitivity** — Linux file system is case-sensitive (`User.ts` ≠ `user.ts`). Windows is not. This can cause mysterious "module not found" errors.
4. **`node_modules` is not portable** — Always delete and reinstall (`npm install`) on the new OS. Some packages compile native binaries (like `bcrypt`) that are OS-specific.
5. **PostgreSQL** — Must be installed separately on Ubuntu (`sudo apt install postgresql postgresql-contrib`). It doesn't carry over from Windows.

### Corporate Proxy / Registry Issues

- If your global `~/.npmrc` points to a corporate registry (e.g., Artifactory), `npm install` will fail on a personal project with `E401 Incorrect or missing password`.
- **Fix:** Create a project-level `.npmrc` with `registry=https://registry.npmjs.org/` to override for that project only.
- The global `~/.npmrc` is left untouched so work projects still function.

### SSL Certificate Errors (Prisma, npm)

- Corporate firewalls/proxies can intercept HTTPS and cause `unable to get local issuer certificate` errors.
- **Workaround:** `NODE_TLS_REJECT_UNAUTHORIZED=0` before the command (e.g., `NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma migrate dev`).
- This disables SSL verification — fine for local dev, **never use in production**.

---

## Prisma v7 Breaking Changes

### No more `url` in `schema.prisma`

In Prisma 7, the `datasource` block no longer accepts `url`. Connection config moved to `prisma.config.ts`.

**Before (Prisma 5/6):**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // ← This breaks in v7
}
```

**After (Prisma 7):**
```prisma
datasource db {
  provider = "postgresql"
  // No url here anymore
}
```

The URL goes in `prisma.config.ts`:
```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

### Driver Adapter Required for PrismaClient

Prisma 7 removed the built-in query engine. You must use a **driver adapter** to connect.

**Install:**
```bash
npm install pg @prisma/adapter-pg
npm install -D @types/pg
```

**Create `src/lib/prisma.ts`:**
```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;
```

**Key points:**
- `PrismaClient()` with no arguments **will crash** — it needs `{ adapter }`.
- `datasourceUrl` is **not a valid option** in Prisma 7 — use the adapter pattern instead.
- `dotenv` must be loaded **before** importing the prisma client, otherwise `DATABASE_URL` is undefined.

---

## PostgreSQL Setup on Ubuntu (WSL)

```bash
# Install
sudo apt update && sudo apt install -y postgresql postgresql-contrib

# Start the service
sudo service postgresql start

# Set password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'yourpassword';"

# Create a database
sudo -u postgres createdb swimming_pool_dev

# Verify
sudo -u postgres psql swimming_pool_dev -c "\dt"
```

**Connection string format:**
```
postgresql://postgres:yourpassword@localhost:5432/swimming_pool_dev
```

**Authentication:** Ubuntu PostgreSQL defaults to `peer` auth for local connections and `scram-sha-256` for TCP (localhost:5432). Your app connects via TCP, so the password in the connection string must match.

### How to Browse Database Tables — Prisma Studio

```bash
cd backend
npx prisma studio
```

Opens a visual UI at http://localhost:5555 where you can:
- Browse all tables (User, Pool, Schedule, MaintenanceRecord, Invoice)
- Filter and sort rows
- Edit or delete records directly
- See relationships between tables

No SQL knowledge needed. It reads your `schema.prisma` and connects to the database automatically.

---

## Environment Variables (`.env`)

- **Never commit `.env`** — it contains secrets (DB passwords, JWT keys). It's in `.gitignore`.
- **No `.env.example` yet** — should create one so others know what variables are needed.
- Minimum required vars for this project:

```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/swimming_pool_dev"
JWT_SECRET="a-strong-random-secret"
PORT=3000

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Pool Cleaning Service <noreply@poolservice.com>
```

- `dotenv.config()` in `index.ts` loads these into `process.env` at startup.

---

## Project Structure — What We Have So Far

```
SwimmingPoolCleaningService/
├── backend/
│   ├── src/
│   │   ├── index.ts          ← Express server entry point
│   │   ├── lib/
│   │   │   ├── prisma.ts     ← Database connection (shared client)
│   │   │   └── email.ts      ← Nodemailer email service
│   │   ├── controllers/      ← Business logic (auth, schedule, etc.)
│   │   ├── routes/           ← API endpoint definitions
│   │   └── middleware/       ← Auth guards, validation
│   ├── prisma/
│   │   ├── schema.prisma      ← Database table definitions
│   │   └── migrations/        ← SQL that created the tables
│   ├── prisma.config.ts       ← Tells Prisma where the DB is
│   ├── tsconfig.json          ← TypeScript settings
│   ├── package.json           ← Dependencies & scripts
│   ├── .env                   ← Secrets (DB URL, JWT key, SMTP)
│   ├── .npmrc                 ← Points npm to public registry
│   └── .gitignore             ← Files git won't track
├── requirement.md             ← What we're building (all phases)
├── ImplementationPhases.md    ← How we're building it (team, order)
├── DatabaseAndAPIDesign.md    ← Schema & API design doc
├── SystemDesign.md            ← Architecture overview
├── TechnologyChoices.md       ← Why we picked each technology
├── LearningNotes.md           ← Your personal learning notes
└── .gitattributes             ← Forces Linux line endings
```

---

## What Each File Does

### `src/index.ts` — The Server

```ts
const app = express();
app.use(cors());          // Allows requests from other domains (frontend)
app.use(express.json());  // Parses JSON request bodies

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });  // Simple "am I alive?" check
});

app.listen(3000);  // Start listening on port 3000
```

Creates a web server. Right now it only has one endpoint (`/api/health`). The TODO comments show where routes will be added.

### `src/lib/prisma.ts` — Database Connection

```ts
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
export default prisma;
```

Creates a single database connection that any file can import. Instead of each file connecting separately, they all `import prisma from './lib/prisma'` and share one connection pool.

**Why a pool?** A pool keeps multiple connections open and reuses them. Without it, every query opens a new connection (slow) and could exhaust the database's connection limit.

### `prisma/schema.prisma` — Database Models

Defines 5 tables and their relationships:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **User** | Customers, technicians, admins | email, name, phone, role, password |
| **Pool** | A customer's swimming pool | address, size, type, notes |
| **Schedule** | A booking/appointment | date, status, customerId, technicianId, poolId |
| **MaintenanceRecord** | Work done on a job | workDone, chemicalsUsed, before/after photos |
| **Invoice** | Payment for a job | amount, status, dueDate |

**Relationships:**
- A User has many Pools (customer → pools)
- A User has many Schedules (as customer or technician)
- A Pool has many Schedules
- A Schedule has one MaintenanceRecord and one Invoice

### `prisma.config.ts` — Prisma Configuration

```ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

Tells the Prisma CLI (migrations, generate) where to find the schema and how to connect to the database. This is separate from how the app connects (that's in `prisma.ts`).

### `.env` — Secrets

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/swimming_pool_dev"
JWT_SECRET="dev-jwt-secret-change-in-production"
PORT=3000
```

Stores configuration that changes between environments (dev vs production). `dotenv.config()` in `index.ts` loads these into `process.env`.

### `package.json` — Scripts

| Script | Command | What it does |
|--------|---------|-------------|
| `npm run dev` | `nodemon --exec ts-node src/index.ts` | Runs server, auto-restarts on file changes |
| `npm run build` | `tsc` | Compiles TypeScript → JavaScript (for production) |
| `npm start` | `node dist/index.js` | Runs the compiled production build |

---

## Current State of the Project

- **PostgreSQL** — 5 empty tables ready to receive data
- **Express server** — Listening on port 3000, only responding to `/api/health`
- **No auth** — Anyone can access any endpoint (nothing to protect yet)
- **No business logic** — No register, login, booking, or scheduling code

---

## What's Next — Auth Layer

The auth layer will add:
1. **Middleware** — A function that checks "does this request have a valid JWT token?" before allowing access
2. **Controller** — `register()` hashes password & saves user; `login()` checks password & returns a JWT
3. **Routes** — `POST /api/auth/register` and `POST /api/auth/login`

After auth, you'll be able to create users, log in, and protect routes by role (admin/technician/customer).

---

## What is JWT (JSON Web Token)?

JWT is a way for your server to remember who a user is **without storing anything on the server**.

### The Problem It Solves

HTTP is **stateless** — every request is independent. The server doesn't remember previous requests. So after a user logs in, how does the server know "this request is from Alice, and she's a customer"?

### How It Works

```
1. User sends:  POST /api/auth/login  { email: "alice@example.com", password: "secret" }
2. Server checks password → correct!
3. Server creates a JWT token containing: { userId: 1, role: "CUSTOMER" }
4. Server signs it with a secret key (JWT_SECRET from .env) and sends it back
5. User stores the token (in browser localStorage or a cookie)

--- Every future request ---

6. User sends:  GET /api/schedules/mine  + Header: "Authorization: Bearer eyJhbGc..."
7. Server reads the token, verifies the signature, extracts { userId: 1, role: "CUSTOMER" }
8. Server knows it's Alice → returns her schedules
```

### What a JWT Looks Like

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJDVVNUT01FUiJ9.abc123signature
```

It's three parts separated by dots:

| Part | Contains | Encoded? | Encrypted? |
|------|----------|----------|------------|
| **Header** | Algorithm used (HS256) | Base64 (readable) | No |
| **Payload** | User data (userId, role) | Base64 (readable) | No |
| **Signature** | Proof it wasn't tampered with | Hashed with JWT_SECRET | Yes |

### Key Points

- **Anyone can read the payload** — it's just base64 encoded, not encrypted. Don't put passwords in it.
- **Nobody can fake it** — the signature is created using your `JWT_SECRET`. If someone changes the payload, the signature won't match and the server rejects it.
- **It expires** — you set a time limit (e.g., 24 hours). After that, the user must log in again.
- **Stateless** — the server doesn't store sessions in memory or a database. The token itself carries all the info.

### In Our Project

```ts
// LOGIN — server creates token
const token = jwt.sign(
  { userId: user.id, role: user.role },  // payload
  process.env.JWT_SECRET,                 // secret key
  { expiresIn: '24h' }                   // expires in 24 hours
);
res.json({ token });

// MIDDLEWARE — server verifies token on protected routes
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// decoded = { userId: 1, role: "CUSTOMER" }
// Now we know who's making the request
```

### Why Not Just Use Sessions?

| | JWT | Sessions |
|---|---|---|
| Stored where? | Client (browser) | Server (memory/DB) |
| Scales easily? | Yes — server stores nothing | No — need shared session store |
| Works across servers? | Yes — any server can verify | No — session is on one server |
| Can be revoked? | Harder (wait for expiry) | Easy (delete from server) |

We chose JWT because it's simpler for an API and scales better.

---

## React Frontend Setup (Phase 4)

### What is Vite?

Vite (French for "fast") is a **build tool** for modern web apps. It replaces older tools like Create React App (CRA) and Webpack.

**Why Vite over CRA?**
- **Instant dev server** — Vite doesn't bundle your entire app on startup. It serves files directly using ES modules, so the dev server starts in milliseconds.
- **Hot Module Replacement (HMR)** — When you save a file, only that module is replaced in the browser. No full page reload.
- **Fast production builds** — Uses Rollup under the hood for optimized bundles.
- CRA is officially deprecated as of 2023. Vite is the recommended replacement.

**Command we used:**
```bash
npm create vite@latest frontend -- --template react-ts
```
- `npm create` = shortcut for `npx create-<package>`
- `--template react-ts` = React with TypeScript (not plain JavaScript)

### What is Tailwind CSS?

Tailwind is a **utility-first CSS framework**. Instead of writing custom CSS classes, you use pre-built utility classes directly in your HTML/JSX.

**Traditional CSS:**
```css
.button { background-color: blue; color: white; padding: 8px 16px; border-radius: 4px; }
```

**Tailwind:**
```html
<button className="bg-blue-600 text-white py-2 px-4 rounded">Click</button>
```

**Why Tailwind?**
- No switching between CSS and JSX files
- No naming CSS classes (no more `.card-wrapper-inner-container`)
- Responsive design is easy: `md:grid-cols-3` means "3 columns on medium screens"
- Tailwind v4 uses `@import "tailwindcss"` in CSS — no config file needed

### Project Structure Explained

```
frontend/
├── src/
│   ├── components/     ← Reusable UI pieces (ProtectedRoute, buttons, etc.)
│   ├── context/        ← React Context providers (shared state)
│   ├── lib/            ← Utility code (API client, helpers)
│   ├── pages/          ← Full page components (one per route)
│   ├── App.tsx         ← Route definitions
│   ├── main.tsx        ← Entry point — wraps app with providers
│   └── index.css       ← Tailwind import
└── vite.config.ts      ← Build tool configuration
```

### React Router — How Routing Works

In a Single Page App (SPA), the browser **never reloads the page**. React Router intercepts URL changes and swaps components.

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
</Routes>
```

- `/login` → shows LoginPage component
- `/register` → shows RegisterPage component
- `/` → shows DashboardPage, but **only if logged in** (ProtectedRoute checks)
- `<Navigate to="/" replace />` on `path="*"` = any unknown URL redirects to home

### React Context — Sharing State Across Components

**Problem:** LoginPage needs to store the JWT token. DashboardPage needs to read the user. How do they share data?

**Solution:** React Context = a "global variable" that any component can access.

```
AuthProvider (wraps entire app)
  ├── LoginPage → calls login() → sets token + user
  ├── DashboardPage → reads user → shows name/role
  └── ProtectedRoute → checks if user exists → redirects if not
```

**How it works in our code:**
1. `AuthContext.tsx` creates the context with `login`, `register`, `logout`, `user`, `token`
2. `main.tsx` wraps `<App />` with `<AuthProvider>` — makes context available everywhere
3. Any component calls `useAuth()` to access the shared state

### Axios API Client — Why Not Just `fetch()`?

We use Axios instead of the built-in `fetch()` because:

| Feature | fetch() | Axios |
|---|---|---|
| Auto JSON parsing | No — need `res.json()` | Yes — `res.data` is already parsed |
| Interceptors | No | Yes — attach token to every request automatically |
| Error handling | Only rejects on network errors | Rejects on 4xx/5xx status codes too |
| Base URL | Must repeat full URL | Set once in `axios.create()` |

**Our interceptor pattern:**
```typescript
// BEFORE every request: attach the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```
This means you never have to manually add the token — it's automatic.

### Vite Proxy — Solving CORS

**Problem:** Frontend runs on `localhost:5173`, backend on `localhost:3000`. Browsers block cross-origin requests (CORS).

**Solution:** Vite proxy — tells the dev server "forward any `/api` request to the backend":

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',  // /api/auth/login → http://localhost:3000/api/auth/login
  },
}
```

The browser thinks it's talking to `localhost:5173`, but Vite secretly forwards to `localhost:3000`. No CORS issue.

### ProtectedRoute — Guarding Pages

```tsx
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;     // Still checking token
  if (!user) return <Navigate to="/login" />; // Not logged in → redirect
  return <>{children}</>;                      // Logged in → show the page
}
```

Wrap any route with `<ProtectedRoute>` to require authentication.

### localStorage — Where the Token Lives

- `localStorage.setItem('token', '...')` — saves the JWT in the browser
- `localStorage.getItem('token')` — reads it back
- Persists across page refreshes and browser restarts
- Cleared on `logout()` with `localStorage.removeItem('token')`

**Security note:** localStorage is vulnerable to XSS attacks. For production, consider httpOnly cookies instead. For a learning project, localStorage is fine.

---

## Nodemailer — Sending Emails

Nodemailer is a Node.js library for sending emails. We use it to send appointment confirmations when a schedule is created.

### What Nodemailer Does

1. Connects to an SMTP server (Gmail, SendGrid, Mailtrap, etc.)
2. Composes an email (to, from, subject, body)
3. Sends it through the SMTP server

### Install

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### Basic Setup

Create `src/lib/email.ts`:

```typescript
import nodemailer from 'nodemailer';

// Create a reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,           // e.g., 'smtp.gmail.com'
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,                          // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,          // your email
    pass: process.env.SMTP_PASS,          // app password (not your real password)
  },
});

// Send an email
export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@poolservice.com',
    to,
    subject,
    html,
  });
}
```

### Environment Variables

Add to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Pool Cleaning Service <noreply@poolservice.com>
```

### Gmail App Password (For Development)

Gmail requires an **App Password** — not your regular password:

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Other (Custom name)" → enter "Pool Service"
3. Click Generate → copy the 16-character password
4. Use this as `SMTP_PASS` in `.env`

**Requires:** 2-Factor Authentication enabled on your Google account.

### Mailtrap — Email Testing Environment

Mailtrap is a **fake email inbox** for developers. Think of it as a **testing environment for emails** — it catches every email your app sends so you can verify they look correct before real customers ever see them.

**Why use Mailtrap?**

| Problem | Without Mailtrap | With Mailtrap |
|---------|------------------|---------------|
| Testing emails | Spam real inboxes | Emails go to your test inbox |
| Accidental sends | Customer gets test data | Email is intercepted |
| Broken templates | Customer sees broken HTML | You catch it first |
| Slow delivery | Wait minutes to verify | Instant preview |
| Domain blacklisting | Risk being marked as spam | Zero risk |

**How it works:**
```
Your app sends email to "customer@example.com"
         ↓
    Mailtrap intercepts it (email NEVER reaches real inbox)
         ↓
    Email appears in YOUR Mailtrap dashboard
         ↓
    You verify: subject, content, HTML rendering, links
```

**Setup:**

1. Sign up at [mailtrap.io](https://mailtrap.io) (free tier: 100 emails/month)
2. Go to **Email Testing** → **Inboxes** → Click your inbox
3. Click **Show Credentials** (SMTP Settings tab)
4. Copy credentials to your `.env` file:

```
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=<your-mailtrap-username>
SMTP_PASS=<your-mailtrap-password>
SMTP_FROM=Pool Cleaning Service <noreply@poolservice.com>
```

**Testing workflow:**

1. Book an appointment in your app (logged in as customer)
2. Go to Mailtrap dashboard → Your inbox
3. See the confirmation email that would have been sent
4. Check: Is the date formatted correctly? Does the technician name show? Is the HTML styled properly?
5. Fix any issues → Test again

**When to switch to real email:**

| Environment | Email Service | Why |
|-------------|--------------|-----|
| **Development** | Mailtrap | Catch bugs before customers see them |
| **Staging** | Mailtrap | Final QA before production |
| **Production** | SendGrid / Gmail | Real emails to real customers |

> **Rule:** Never use production email credentials in development. Always use Mailtrap until you're ready to go live.

### Sending Confirmation on Schedule Creation

In `schedule.controller.ts`, after creating a schedule:

```typescript
import { sendEmail } from '../lib/email';

// After prisma.schedule.create()
await sendEmail(
  customer.email,
  'Appointment Confirmed',
  `<h1>Your pool cleaning is scheduled!</h1>
   <p>Date: ${schedule.date.toLocaleDateString()}</p>
   <p>Technician: ${schedule.technician.name}</p>`
);
```

### Why Not SendGrid or Twilio Directly?

| Service | How Nodemailer Uses It | When to Use |
|---------|------------------------|-------------|
| **Gmail** | SMTP transport | Development, small scale |
| **SendGrid** | SMTP or API transport | Production, high volume, need analytics |
| **Mailtrap** | SMTP transport | Testing without sending real emails |

Nodemailer is the **client** — it talks to any SMTP server. For production, pair it with SendGrid for better deliverability and tracking.

### Error Handling

Wrap email sending in try/catch — don't let email failures crash the booking:

```typescript
try {
  await sendEmail(customer.email, 'Appointment Confirmed', html);
} catch (err) {
  console.error('Failed to send confirmation email:', err);
  // Log but don't fail the request — booking still succeeded
}
```

---

## File Storage — Uploading Pool Photos

Technicians upload before & after photos when completing a job. These images need to be stored somewhere.

### The Problem

- Images are **binary files** (not text) — don't store them in the database
- Images can be large (5-10 MB each) — need scalable storage
- Images need to be **served to browsers** — need public URLs

### Storage Options Comparison

| Option | Free Tier | Expires? | Credit Card? | Best For |
|--------|-----------|----------|--------------|----------|
| **Local disk** | Unlimited (your computer) | N/A | No | Development only |
| **Cloudflare R2** | 10 GB, 1M requests/month | **Never** | **No** | Learning + Production ✓ |
| **AWS S3** | 5 GB | 12 months | Yes | Production |
| **Azure Blob Storage** | 5 GB | 12 months | Yes | Production (Azure ecosystem) |
| **Google Cloud Storage** | 5 GB | 90 days | Yes | Production (GCP ecosystem) |
| **Backblaze B2** | 10 GB | Never | No | Budget production |
| **Supabase Storage** | 1 GB | Never | No | Quick prototypes |

### Our Choice: Cloudflare R2 (for production)

**Why R2 for production:**

| Feature | Why It Matters |
|---------|----------------|
| **$0 egress fees** | AWS/Azure charge ~$0.09/GB when users view images. R2 is free. |
| **Free tier never expires** | 10 GB forever, not a 12-month trial |
| **No credit card required** | Start immediately, no billing surprises |
| **S3-compatible API** | Same code works if you switch to AWS later |
| **Built-in CDN** | Images served fast globally |
| **99.999999999% durability** | Same as AWS S3 (11 nines) |

**Cost comparison at scale:**

| Monthly Usage | AWS S3 | Cloudflare R2 |
|---------------|--------|---------------|
| 10 GB stored, 100 GB downloaded | ~$11 | **$0.15** |
| 100 GB stored, 1 TB downloaded | ~$100 | **$1.50** |

### Our Approach: Local First, Then Cloud

**Phase 1 (Now):** Use **local disk storage** during development
- Zero setup — files saved to `backend/uploads/` folder
- Focus on learning how file uploads work (multer, multipart forms)
- Test the complete flow end-to-end

**Phase 2 (After deployment testing):** Switch to **Cloudflare R2**
- Only change where files are saved — upload logic stays the same
- Production-ready, scalable storage
- No code rewrite needed

### How File Uploads Work

The complete flow for uploading pool photos:

```
┌──────────┐     ┌─────────┐     ┌────────┐     ┌──────────┐     ┌──────────┐
│ Browser  │     │ Express │     │ Multer │     │  Disk /  │     │ Database │
│(Frontend)│     │ (Route) │     │(Parser)│     │  Cloud   │     │(Prisma)  │
└────┬─────┘     └────┬────┘     └───┬────┘     └────┬─────┘     └────┬─────┘
     │                │              │               │                │
     │ POST /api/uploads             │               │                │
     │ (multipart/form-data)         │               │                │
     │ ──────────────►│              │               │                │
     │                │  Parse file  │               │                │
     │                │─────────────►│               │                │
     │                │              │  Save to disk  │                │
     │                │              │──────────────►│                │
     │                │              │  Return info   │                │
     │                │              │◄──────────────│                │
     │                │ req.file = {filename, path}  │                │
     │                │◄─────────────│               │                │
     │  { url: "/uploads/abc123.jpg" }               │                │
     │ ◄──────────────│              │               │                │
     │                │              │               │                │
     │ POST /api/maintenance (with photo URL)        │                │
     │ ──────────────►│              │               │   Save URL     │
     │                │──────────────────────────────────────────────►│
     │                │              │               │                │
     │ GET /uploads/abc123.jpg       │               │                │
     │ ──────────────►│              │               │                │
     │                │  express.static('uploads')   │                │
     │                │─────────────────────────────►│                │
     │  Image file    │              │               │                │
     │ ◄──────────────│              │               │                │
```

### Step-by-Step Breakdown

**Step 1: User picks a file (Frontend)**
```html
<input type="file" accept="image/*" onChange={handleUpload} />
```
The browser shows a file picker. User selects a photo. The file is stored in memory in the browser.

**Step 2: Frontend sends file to backend**
```typescript
const formData = new FormData();
formData.append('photo', file);  // 'photo' is the field name multer expects
await api.post('/uploads', formData);
```
The browser encodes the file as `multipart/form-data` — a special format for sending binary files over HTTP. This is NOT JSON. `express.json()` can't read it — that's why we need multer.

**Step 3: Multer parses the file (Backend middleware)**
```typescript
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

// multer runs BEFORE the controller
router.post('/uploads', upload.single('photo'), uploadController);
```
Multer intercepts the request, extracts the binary file from multipart/form-data, saves it to the `uploads/` folder with a random filename (e.g., `abc123def456`), and puts file info on `req.file`.

**Step 4: Controller returns the URL**
```typescript
function uploadPhoto(req, res) {
  // multer already saved the file — we just return the URL
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
}
```

**Step 5: URL is saved to database**
When technician submits the maintenance record, the photo URL is stored in `MaintenanceRecord.photoBeforeUrl` or `photoAfterUrl`.

**Step 6: express.static serves the file**
```typescript
app.use('/uploads', express.static('uploads'));
```
When the frontend renders `<img src="/uploads/abc123.jpg">`, Express looks in the `uploads/` folder and sends the file to the browser. No controller needed — `express.static` handles it automatically.

### What is multipart/form-data?

HTTP has different content types:
| Content-Type | Used For | Example |
|---|---|---|
| `application/json` | Sending data | `{ "name": "Alice" }` |
| `multipart/form-data` | Sending files (+ data) | Binary image data with boundaries |
| `text/html` | Web pages | `<html>...` |

When you send a file, the browser splits the request into "parts" separated by boundaries:
```
------WebKitFormBoundary
Content-Disposition: form-data; name="photo"; filename="pool.jpg"
Content-Type: image/jpeg

[binary image data here]
------WebKitFormBoundary--
```
Express's `express.json()` only understands JSON. Multer understands this multipart format.

### What is express.static?

A built-in Express middleware that serves files from a folder. No routes or controllers needed.

```typescript
app.use('/uploads', express.static('uploads'));
//       ↑ URL path             ↑ folder on disk
```

| Request | Express does |
|---------|-------------|
| `GET /uploads/abc123.jpg` | Reads `uploads/abc123.jpg` from disk → sends to browser |
| `GET /uploads/xyz789.png` | Reads `uploads/xyz789.png` from disk → sends to browser |
| `GET /uploads/missing.jpg` | File not found → sends 404 |

It's like a simple file server. No business logic — just "here's the file you asked for."

### Why Not Store Images in the Database?

| | In Database (BLOB) | In File Storage |
|---|---|---|
| Speed | Slow — DB not optimized for binary | Fast — file systems/CDNs are built for this |
| Size | Bloats your database | Doesn't affect DB size |
| Cost | DB storage is expensive | File storage is cheap ($0.02/GB) |
| Backups | Makes DB backups huge and slow | Backed up separately |
| Serving | Must read from DB on every request | Served directly from disk/CDN |

**Rule:** Store the **URL** in the database, store the **file** in file storage.

### Real Example from Our App

After a technician uploads a photo and submits the maintenance form, here's what's stored where:

**Database (MaintenanceRecord table):**
```json
{
  "id": 1,
  "scheduleId": 3,
  "workDone": "Complete, testing uploading of the image",
  "chemicalsUsed": null,
  "photoBeforeUrl": "/uploads/1778689006077-517791727.png",   ← just the URL path
  "photoAfterUrl": null,
  "completedAt": "2026-05-13T16:16:46.393Z"
}
```

**Disk (backend/uploads/ folder):**
```
uploads/
  .gitkeep
  1778689006077-517791727.png   ← actual 65 KB image file
```

The database row is tiny (a few hundred bytes). The image (65 KB) lives on disk. When the frontend renders `<img src="/uploads/1778689006077-517791727.png">`, Express's `express.static` serves the file directly from the folder — no database query needed.

### Security Considerations

- **Validate file type** — Only accept images (jpg, png, gif), reject executables
- **Limit file size** — Set max size (e.g., 5 MB) to prevent abuse
- **Random filenames** — Multer generates random names by default, preventing path traversal attacks
- **Don't trust the extension** — Check the file's actual MIME type, not just the extension

---

## Stripe Payments (Phase 9)

### What is Stripe?

Stripe is a payment processing platform. Instead of handling credit card numbers yourself (which requires PCI compliance — expensive and complex), Stripe handles all the sensitive card data. Your server never sees the card number.

### PaymentIntent Flow

Stripe uses a two-step "PaymentIntent" pattern:

```
1. Customer clicks "Pay" on the frontend
2. Frontend calls YOUR backend: POST /api/invoices/:id/pay
3. Your backend calls Stripe API: stripe.paymentIntents.create({amount, currency})
4. Stripe returns a "clientSecret" — a one-time token
5. Your backend sends clientSecret to frontend
6. Frontend uses Stripe.js (their JavaScript SDK) to collect card details
   → Card number goes DIRECTLY to Stripe (never touches your server)
7. Stripe processes the payment
8. Frontend calls YOUR backend: POST /api/invoices/:id/confirm
9. Your backend calls Stripe: stripe.paymentIntents.retrieve(id)
10. If status === 'succeeded', mark invoice as PAID
```

**Why two steps?** Security. Your server creates the *intent* to charge, but the actual card data goes directly from the browser to Stripe. You never handle sensitive payment data.

### Key Stripe Concepts

| Concept | What It Means |
|---|---|
| **PaymentIntent** | Represents a single payment attempt. Has states: `requires_payment_method` → `succeeded` |
| **clientSecret** | One-time token sent to frontend so Stripe.js can confirm the payment |
| **Amount** | Always in **cents** (smallest currency unit). $150.00 = `15000` |
| **Idempotency** | Stripe deduplicates requests — if you accidentally call create twice with the same key, you get the same PaymentIntent back |
| **Test mode** | Use test API keys (start with `sk_test_`) — no real charges. Test card: `4242 4242 4242 4242` |

### Setting Up Stripe

```bash
npm install stripe          # Backend SDK
```

```typescript
// backend/src/lib/stripe.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create a payment intent (amount in dollars, converted to cents)
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(amountInDollars * 100),  // $150 → 15000 cents
  currency: 'usd',
  metadata: { invoiceId: '42' },              // your reference
});

// Returns: { id: 'pi_xxx', client_secret: 'pi_xxx_secret_yyy' }
```

### Graceful Degradation

Our Stripe service (`backend/src/lib/stripe.ts`) doesn't crash if `STRIPE_SECRET_KEY` is missing — it returns an error message instead. This way the rest of the app works fine without Stripe configured (useful for development/testing).

---

## PDF Generation with PDFKit (Phase 9)

### What is PDFKit?

PDFKit is a Node.js library that creates PDF documents programmatically. You write code that says "put this text here, draw a line there, add a table" — and it generates a PDF file as a Buffer (raw bytes).

### How We Use It

```typescript
// backend/src/lib/pdf.ts
import PDFDocument from 'pdfkit';

function generateInvoicePDF(data): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Add content
    doc.fontSize(20).text('INVOICE', { align: 'right' });
    doc.text(`#INV-${data.invoiceNumber}`);
    doc.text(`Amount: $${data.amount}`);
    // ... more content

    doc.end();  // Finalize the PDF
  });
}
```

### Key Concepts

| Concept | What It Means |
|---|---|
| **Buffer** | Raw binary data in memory. The PDF is generated as a Buffer, then sent as an HTTP response |
| **Streaming** | PDFKit emits data in chunks (events). We collect chunks and concatenate them |
| **Content-Type** | Set `res.setHeader('Content-Type', 'application/pdf')` so the browser knows it's a PDF |
| **Content-Disposition** | `attachment; filename="invoice.pdf"` tells the browser to download instead of display inline |

### Serving the PDF

```typescript
// In the controller
const pdfBuffer = await generateInvoicePDF(invoiceData);
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename="INV-0001.pdf"`);
res.send(pdfBuffer);
```

The browser receives the raw PDF bytes and either displays it in a viewer or downloads it.

---

## Auto-Generated Invoices (Phase 9)

When a technician logs a maintenance record, the system automatically:

1. Creates the MaintenanceRecord in the database
2. Marks the Schedule status as `COMPLETED`
3. Creates an Invoice: $150 default amount, due date = 14 days from now, status = `PENDING`

This happens in `maintenance.controller.ts` inside a single database transaction — either all three operations succeed or none do.

### Overdue Invoice Detection

A cron job runs daily at 9:00 AM:
1. Finds all invoices with status `PENDING` and `dueDate < now`
2. Updates their status to `OVERDUE`
3. Sends a styled email reminder to each customer with the invoice details

---

## Deployment: Local vs Production (Phase 11)

### What "localhost" means

When you run `npm run dev`, your app only exists on your own laptop. `localhost` literally means "this computer". Nobody else can reach `http://localhost:3000` — it's not on the internet.

### What deployment does

Deployment copies your code to a computer in the cloud that:
- Runs 24/7 (even when your laptop is off)
- Has a real public URL (e.g. `https://yourapp.up.render.app`)
- Anyone in the world can access

### Why we use two services (Render + Vercel)

```
Render                              Vercel
───────────────────────────────      ──────────────────────────────
Runs: Node.js Express backend        Runs: React frontend (static files)
Runs: PostgreSQL database            Auto-deploys on git push
Always-on server process             Serves files from global CDN
Cost: ~$0–10/month                   Cost: $0 (free tier)
```

They're separate because:
- **Backend** needs a persistent server process (Express keeps running, cron jobs fire, DB connections stay open)
- **Frontend** is just HTML/CSS/JS files — no server needed, just a CDN to serve them fast

### How TypeScript runs in production (vs development)

| Mode | How TypeScript runs |
|---|---|
| **Development** | `ts-node src/index.ts` — runs TypeScript directly (slow start, no compilation step) |
| **Production** | `tsc` compiles to JavaScript → `node dist/index.js` runs the compiled JS (faster, proper for servers) |

Render runs `npm run build` (which runs `prisma generate && tsc`) then `npm start` (which runs `node dist/index.js`).

### What VITE_API_URL does

In development, Vite's **proxy** forwards `/api` requests from the frontend to `localhost:3000`:
```
Browser → GET /api/invoices
Vite dev server intercepts → forwards to http://localhost:3000/api/invoices
```

In production, the frontend is served by the same Express server as the API — so `/api` requests go directly to the same origin. **No `VITE_API_URL` is needed in production.** The default `/api` base URL in `api.ts` works for both development (via Vite proxy) and production (same-origin).

Variables prefixed with `VITE_` are **baked into the frontend bundle at build time** by Vite. They are NOT secret — they end up in the JavaScript that browsers download. Never put passwords in `VITE_` variables.

### What FRONTEND_URL does on the backend

CORS (Cross-Origin Resource Sharing) is a browser security rule: if the frontend and API are on different domains, the browser blocks API calls unless the server explicitly allows it.

In our single-service setup, **CORS is not needed in production** — the frontend and API are same-origin (same URL). The CORS middleware is configured as a fallback for development:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
}));
```

In development, the frontend runs on `localhost:5173` and the API on `localhost:3000` — different ports = different origins, so CORS is needed. In production, both are on the same Render URL, so CORS doesn't apply.

### Environment variables: dev vs production

| Variable | Development (.env) | Production (Render dashboard) |
|---|---|---|
| `DATABASE_URL` | `postgresql://localhost:5432/...` | Render auto-sets this |
| `JWT_SECRET` | any string | long random secret |
| `FRONTEND_URL` | `http://localhost:5173` | Your Render URL (e.g. `https://yourapp.up.render.app`) |
| `STRIPE_SECRET_KEY` | test key (`sk_test_...`) | live key (`sk_live_...`) |
| `SMTP_*` | Mailtrap (catches emails) | SendGrid (sends real emails) |

### Why Render's filesystem is ephemeral

Render servers can restart, redeploy, or move to different hardware at any time. When that happens, **any files written to disk are lost**. This means:
- `backend/uploads/` (photo storage) **does not work** on Render
- Solution: use **Cloudflare R2** (cloud object storage) — files stored there persist forever

This is a known trade-off with cloud platforms. The database persists (it's a separate managed service), but the local filesystem is temporary.
