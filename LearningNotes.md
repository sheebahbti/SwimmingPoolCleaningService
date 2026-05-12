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
