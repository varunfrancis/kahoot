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
2. Open **SQL Editor**, paste and run each migration in order:
   - `supabase/migrations/0001_init.sql` — schema, RLS, RPCs, realtime.
   - `supabase/migrations/0002_aayushi_rule.sql` — Aayushi-as-reference rule.
   - `supabase/migrations/0003_finalize_on_end.sql` — score only at game end.
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

## Question types & scoring (Aayushi rule)

A player with nickname `aayushi` (case-insensitive) is the reference. For
each question, other players score by matching *her* submission — not the
`correct_answer` configured in the quiz builder. If Aayushi isn't in the
room (or didn't answer a given question), nobody scores that question.

| Type | Scoring |
|---|---|
| Multiple choice | up to 1000, speed-weighted, if `index` matches Aayushi's |
| True / False | up to 1000, speed-weighted, if `value` matches Aayushi's |
| Ranking | up to 1000, speed-weighted, only if the full 4-item order matches Aayushi's exactly |
| Type answer | up to 1000, speed-weighted; normalized equality with Aayushi's text, fuzzy Levenshtein if the question's fuzzy flag is on |
| Word cloud | up to 1000, speed-weighted, for any non-empty submission (no Aayushi dependency) |

Scoring is **deferred to game end**: `submit_answer` only records the
response. When the host advances past the last question, `advance_question`
flips the room to `finished` and loops through every question, calling
`finalize_question` (idempotent via the `question_finalizations` table) to
compute points in a single transaction. Scores stay at 0 during the game
and populate once the final screen appears.

## Per-question flow

- Everyone sees the question at the same time, with a per-question timer.
- A player who submits early sees "Answer locked in" and waits.
- A player whose timer expires before submitting sees "Time's up" and
  waits — no late submissions.
- The host's **Next question** button is disabled until everyone has
  answered or the timer runs out.
- No scores or reveals are shown mid-game. The final leaderboard appears
  after the host clicks "Show final results".

## Project layout
- `src/app/` — App Router pages
- `src/components/question-editors/` — per-type question editor UIs
- `src/components/player-answer/` — per-type player answer UIs
- `src/components/host-live-view/` — host live views + reveal panel
- `src/lib/supabase/` — Supabase browser/server clients, DB types
- `src/lib/shuffle.ts` — deterministic seeded shuffle for ranking
- `supabase/migrations/0001_init.sql` — single source of truth for DB schema
