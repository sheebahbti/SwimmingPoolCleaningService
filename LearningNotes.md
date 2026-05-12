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

---

## Environment Variables (`.env`)

- **Never commit `.env`** — it contains secrets (DB passwords, JWT keys). It's in `.gitignore`.
- **No `.env.example` yet** — should create one so others know what variables are needed.
- Minimum required vars for this project:

```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/swimming_pool_dev"
JWT_SECRET="a-strong-random-secret"
PORT=3000
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
│   │   │   └── prisma.ts     ← Database connection (shared client)
│   │   ├── controllers/      ← Empty (business logic goes here)
│   │   ├── routes/            ← Empty (API endpoints go here)
│   │   └── middleware/        ← Empty (auth guards go here)
│   ├── prisma/
│   │   ├── schema.prisma      ← Database table definitions
│   │   └── migrations/        ← SQL that created the tables
│   ├── prisma.config.ts       ← Tells Prisma where the DB is
│   ├── tsconfig.json          ← TypeScript settings
│   ├── package.json           ← Dependencies & scripts
│   ├── .env                   ← Secrets (DB URL, JWT key)
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
