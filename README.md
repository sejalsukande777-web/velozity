# Velozity Global Solutions — Client Project Dashboard

This is a full stack app for a small agency to manage clients, projects,
and tasks. It has role-based login (Admin, Project Manager, Developer) and
a live activity feed that updates in real time using WebSockets.

## Tech used

- **Frontend**: React + TypeScript, built with Vite. React Router for
  pages, Socket.io-client for the live feed.
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Real-time**: Socket.io
- **Background job**: node-cron
- **Auth**: JWT (access token + refresh token)

### Why I picked these

- **Express, not Fastify**: I know Express better and it has a lot of
  tutorials/examples, so it was faster for me to build with.
- **Prisma, not raw SQL**: Prisma gives you TypeScript types for your
  database automatically, so I get autocomplete and fewer typos in queries.
  Also handles migrations for you.
- **Socket.io, not plain WebSocket**: Socket.io already has "rooms" built
  in, which is exactly what I needed to send updates to only the right
  people (like, only a PM's own project, not everyone). Doing that with
  plain WebSocket would mean building that logic myself.
- **node-cron, not a queue like Bull**: I only needed one simple job that
  runs every few minutes (checking for overdue tasks). A full job queue
  needs Redis and extra setup, which felt like overkill for just one job.
- **Access token in memory + refresh token in an httpOnly cookie**: this
  way the access token isn't sitting in localStorage where any injected
  script could read it, and the refresh token can't be touched by
  JavaScript at all since it's httpOnly.

## Folder structure

```
backend/   Express + TypeScript API, Prisma schema, sockets, cron job
frontend/  React + TypeScript app (Vite)
```

## How to run this locally

I did not use Docker for this. I set up Postgres directly on my machine
instead — it was simpler for me to get working and debug than adding
Docker on top of everything else I was learning.

### What you need first
- Node.js 18 or newer
- PostgreSQL installed and running

### 1. Backend setup

```
cd backend
npm install
cp .env.example .env
```

Open `.env` and put in your own Postgres password if it's different from
what's in the example file. Then:

```
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

The backend runs on `http://localhost:4000`. The cron job and the
WebSocket server both start automatically with it, no extra command
needed.

### 2. Frontend setup

Open a second terminal:

```
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

### Environment variables (backend/.env)

| Variable | What it's for |
|---|---|
| `PORT` | Which port the backend runs on (4000) |
| `FRONTEND_ORIGIN` | So the backend allows requests from the frontend |
| `DATABASE_URL` | Your Postgres connection string |
| `JWT_ACCESS_SECRET` | Used to sign short-lived login tokens |
| `JWT_REFRESH_SECRET` | Used to sign longer-lived refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | How long an access token lasts (15m) |
| `JWT_REFRESH_EXPIRES_IN` | How long a refresh token lasts (7d) |

### Test logins (from the seed script)

Everyone uses the same password: `Password123!`

The seed script makes 1 Admin, 2 Project Managers, and 4 Developers, plus
some sample projects and tasks so the app isn't empty when you first open
it.

## Database design

Main tables: `User`, `Client`, `Project`, `Task`, `ActivityLog`,
`Notification`. You can see the full thing in
`backend/prisma/schema.prisma`.

How they connect: a Client has many Projects, a Project is created by a PM
and has many Tasks, a Task is assigned to one Developer, and every task
status change gets its own row in ActivityLog. Notifications belong to
whichever user they're for.

### Indexes I added and why

| Column | Why I indexed it |
|---|---|
| `Task.projectId` | Task lists are always filtered by project |
| `Task.assignedToId` | Developers load "my tasks" a lot |
| `Task.status` | Used for both dashboard counts and the status filter |
| `Task.dueDate` | Used by the overdue job, "due this week", and the date filter |
| `Project.createdById` | PMs always query "my own projects" |
| `ActivityLog.taskId, createdAt` | Feed loads recent activity in order |
| `Notification.userId, isRead` | Unread count gets checked on almost every page |

## Some design choices I made

- **Rooms for the live feed**: instead of putting each Developer in a
  room for every task they're assigned (which means updating room
  membership every time a task gets reassigned), I just put every user in
  one personal room based on their own user ID. When something changes, the
  server checks in the database who's currently assigned and sends the
  update to their room. This way reassigning a task doesn't need any extra
  code to keep rooms in sync.
- **Catching up on missed activity**: I didn't build a separate endpoint
  for this. The normal `GET /activity` route already reads from the
  database (not from memory), so it works fine for both "show me the feed"
  and "catch me up on what I missed."

## Things I know are not perfect

- **Refresh tokens don't rotate.** Same refresh token gets reused until
  it expires (7 days) instead of being swapped out every time it's used.
  A more secure setup would rotate it.
- **The cookie setting `SameSite=Lax` assumes frontend and backend are on
  the same site.** That's true for local dev, but if I deploy them on two
  totally different domains, this cookie won't get sent and I'd need to
  change it to `SameSite=None; Secure`.
- **The activity feed shows the task's title, not a task number like
  "Task #12."** My tasks use random IDs (UUIDs) instead of simple numbers
  1, 2, 3..., so there's no natural number to show. I could add a separate
  counter field for this but didn't want to touch the database schema
  again this late.
- **A task's overdue flag only updates from the cron job (or when it's
  marked Done)**, not every single time you load the page. That's on
  purpose — it's supposed to be a background job, not something
  recalculated live.
- **Two routes ended up open to more roles than I first planned.**
  `GET /clients` and a new `GET /users` route are open to PMs too (not
  just Admin), because a PM can't actually create a project without
  knowing which clients or developers exist. Only Admin can still create
  new clients though.

## Deploying this

**The frontend can go on Vercel fine** — it's just a static build.

**The backend can't go on Vercel.** Vercel runs backend code as
serverless functions, which shut down between requests. My backend needs
to stay running the whole time to keep WebSocket connections open and run
the cron job in the background — that just doesn't work as a serverless
function. So I'm hosting the backend somewhere that keeps a server running
all the time instead (like Render or Railway — both have free plans and
support this).

## Explanation (for the submission form)

> The hardest part for me was making sure the live feed only shows people
> what they're allowed to see, without writing that filtering logic twice
> (once for the normal feed, once for catching up after reconnecting). I
> fixed this by putting all the role-checking in one function that both
> places call, so there's only one place that decides who sees what.
>
> For the real-time part, I first planned to put each developer in a
> separate room for every task assigned to them, but that meant updating
> room membership every time a task got reassigned. I changed it so every
> user just has one personal room, and the server looks up who's
> currently assigned when it sends an update. Reassigning a task doesn't
> need any extra syncing code this way.
>
> One thing I'd do differently: I'd add a simple task number (like Task
> #1, #2, #3) from the start, so the feed messages could say "moved Task
> #12" exactly like the example. I ended up using the task's title
> instead because adding a number field later would mean another database
> migration on data I'd already seeded, and I didn't want to redo that
> this late into the project.
