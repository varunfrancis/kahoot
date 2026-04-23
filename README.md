# Multiplayer Quiz Game

A real-time Kahoot-style quiz app. Hosts build quizzes and launch game rooms;
players join with a code and nickname; scoring is speed-weighted and happens
server-side.

## Stack
- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4
- Supabase (Postgres + Realtime + Auth)
- `@dnd-kit` for ranking drag-and-drop
- `bad-words` for word-cloud profanity filter

## Setup

### 1. Supabase project
1. Create a new project at https://supabase.com/.
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`,
   and run it. This sets up schema, RLS, RPCs, and realtime publications.
3. Open **Authentication → Users** and create a host account (email + password).
   There is no self-serve signup flow.
4. Open **Project Settings → API** and copy the project URL and anon key.

### 2. Environment
```bash
cp .env.local.example .env.local
# then paste NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Install & run
```bash
npm install
npm run dev
```
Visit http://localhost:3000.

## Playing

- Host: go to `/login`, sign in, click **New quiz**, add questions, then click
  **Launch game**. A room code appears; share with players.
- Players: from `/`, enter the code + a nickname. Wait for the host to start.
- Host clicks **Start game** → **Next question** through the deck.
- Between questions the host sees the correct answer + top 5; each player sees
  their own result + leaderboard rank.

## Question types
| Type | Scoring |
|---|---|
| Multiple choice | up to 1000, speed-weighted |
| True / False | up to 1000, speed-weighted |
| Ranking (drag 4 into order) | 250 × correctly-placed × speed multiplier |
| Type answer | up to 1000 if exact or fuzzy match |
| Word cloud | flat 200 per submission |

All scoring runs in the `submit_answer` Postgres RPC — the client never decides
points.

## Project layout
- `src/app/` — App Router pages
- `src/components/question-editors/` — per-type question editor UIs
- `src/components/player-answer/` — per-type player answer UIs
- `src/components/host-live-view/` — host live views + reveal panel
- `src/lib/supabase/` — Supabase browser/server clients, DB types
- `src/lib/shuffle.ts` — deterministic seeded shuffle for ranking
- `supabase/migrations/0001_init.sql` — single source of truth for DB schema
