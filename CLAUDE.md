# Fara — IELTS Vocabulary App

A mobile-first spaced repetition vocabulary app built with Next.js 16 / React 19 / TypeScript / Supabase. Users capture words from IELTS reading/listening, look up senses and synonyms, and review through 8 practice modes driven by the SM-2 algorithm.

## Commands

```bash
bun run dev          # dev server at :3000
bun run build        # production build (runs tsc via next build)
bun run test         # vitest run (one-shot)
bun run test:watch   # vitest watch
bun run lint         # eslint
```

TypeScript is checked by `next build`. For a standalone check without building:
```bash
bunx tsc --noEmit
```

## Project layout

```
src/
  app/              # Next.js App Router pages + API routes
  components/       # React client components
  lib/
    types.ts        # ALL shared interfaces — start here
    srs.ts          # SM-2 algorithm (pure, fully tested)
    session.ts      # Queue building, mode selection, session state machine
    answer.ts       # Typo-tolerant answer validation, cloze extraction
    senses.ts       # Sense ranking, synonym candidate merging
    data.ts         # Supabase queries + offline outbox
    exportData.ts   # CSV / JSON backup generation
    dictionary/     # Provider adapters (Free Dictionary, Datamuse, MW)
    supabase/       # Browser and server Supabase clients
  proxy.ts          # Next.js middleware (session refresh + auth redirect)

tests/              # Vitest suites (pure logic only — no DB, no network)
supabase/           # SQL migrations
```

## Domain knowledge

### SM-2 algorithm (`src/lib/srs.ts`)

Cards have `ease` (≥1.3), `interval_days`, `repetitions`, and `lapses`. Four buttons:

| Button | SM-2 quality | Effect |
|--------|-------------|--------|
| Again  | —           | Resets to 0 reps, adds lapse if previously learned, due in `againMinutes` |
| Hard   | q=3         | Multiplies by `hardMultiplier` (default 1.2), lowers ease |
| Good   | q=4         | Multiplies by `ease`, ease unchanged |
| Easy   | q=5         | Multiplies by `ease × easyBonus`, raises ease |

Day boundaries are anchored to local midnight — a card due "in 1 day" is due all of tomorrow, not 24 h from now. `isDueToday` checks `due_at < start of tomorrow`.

Reviewing before due: Hard/Good/Easy are logged but **do not change the schedule** (`changed: false`). Again still resets — forgetting is real information.

### Session state machine (`src/lib/session.ts`)

`SessionState` is a pure value object:
```
buildQueue → startSession → loop: currentItem → rate → rateCurrent → isFinished?
```

`rateCurrent` inserts a recall retry if rated Again (up to `MAX_REQUEUES=2` times, `REQUEUE_GAP=3` cards later). State is persisted to `localStorage` via `saveSession`/`loadSession` so sessions survive refreshes.

### Review modes

| Mode        | Requires |
|-------------|----------|
| recall      | always |
| reverse     | meaning or uzbek |
| type        | meaning or uzbek |
| paraphrase  | meaning or paraphrase field |
| cloze       | context containing the term |
| choice      | meaning/uzbek + ≥3 distractor words |
| synonym     | verified replacements + cloze + ≥2 distractors |
| listen      | audio URL or device TTS |

Mode weights favour recognition (recall, choice) for new/difficult words; production (cloze, type) for mature ones.

### Synonym pipeline

1. User triggers `/api/lookup` → server calls provider adapters in parallel
2. `senses.ts` ranks senses by word-overlap with user's context
3. User picks a sense → `buildCandidates` merges sense synonyms + provider candidates
4. User marks each candidate `fits` / `rejected` / `unreviewed`
5. `verifiedReplacements` (verdict=`fits`) are used in synonym mode and shown in ReviewCard

### Offline queue (`src/lib/data.ts`)

`recordReview` writes to Supabase immediately. On network failure it pushes to `localStorage`'s `ielts-vocab:outbox` array. `flushOutbox` drains it in order on reconnect (deduplicated, prevents concurrent flush with `flushing` lock). Only real DB errors (`err.code` truthy) are re-thrown; network errors silently queue.

## HTTP / data fetching

All external HTTP calls go through **axios** (not native `fetch`):

| Location | Direction | Library |
|---|---|---|
| `src/lib/dictionary/http.ts` | Server → external dictionary APIs | `axios` |
| `src/components/SynonymPanel.tsx` | Browser → `/api/lookup` | `axios` |

`http.ts` exports a `getJson(url, opts)` helper that:
- Uses `validateStatus: () => true` so HTTP errors are handled explicitly (not thrown by axios)
- Retries once on network errors (`retryable: true`)
- Throws `ProviderError` with a typed status (`not_found` · `rate_limited` · `error`)

In components, use `axios.isAxiosError(err)` to distinguish network/HTTP errors from programming errors.

**Do not** use native `fetch` directly — use `axios` or the `getJson` helper.

## TypeScript conventions

- Shared types live **only** in `src/lib/types.ts`. Do not duplicate them.
- Prefer `import type` for type-only imports.
- No `any` — use `unknown` + narrowing or explicit casting with a comment.
- Non-null assertions (`!`) only at system boundaries (Supabase env vars) — flag all others.
- Supabase query results are cast to typed interfaces (`Word`, `Review`, etc.) since we don't run `supabase gen types`. Add overloads if you add new tables.
- React component props get explicit interfaces above the function — no inline anonymous types for complex shapes.
- `'use client'` must be the very first line of client components (before imports).

## Testing

Tests live in `tests/` and run against the compiled TypeScript (no mocking of the TS compiler). They test **pure logic only**:
- `srs.test.ts` — SM-2 scheduling edge cases
- `session.test.ts` — Queue building, mode selection, session state machine
- `answer.test.ts` — Answer normalisation, levenshtein, cloze extraction
- `senses.test.ts` — Sense ranking, candidate merging
- `dictionary.test.ts` — Provider adapters (HTTP mocked via vi.mock)
- `exportData.test.ts` — CSV/JSON serialisation
- `flows.test.tsx` — ReviewCard component (DOM, RTL)

The test files use vitest + `@testing-library/react`. No Supabase, no `next/navigation` in logic tests.

## GitHub collaboration

### One-time setup

```bash
brew install gh          # GitHub CLI
gh auth login            # authenticate (follow prompts)
```

### Repository
`https://github.com/Temur01/IELTS-tool-for-myself`

### Branch strategy (GitHub Flow)

```
main  ← always deployable, auto-deployed to Vercel
  └─ feat/add-uzbek-tts
  └─ fix/cloze-phrase-detection
  └─ refactor/session-types
```

- **Never commit directly to `main`** for any change bigger than a one-liner typo fix.
- Branch name format: `<type>/<short-slug>` using the same types as Conventional Commits.
- One logical change per PR — easier to review, easier to revert.

### Day-to-day workflow

```bash
# Start work on a new thing
git checkout main && git pull origin main
git checkout -b feat/my-feature

# During work — checkpoint commits are fine on feature branches
git add -p                        # stage hunks interactively
git commit -m "feat(scope): ..."

# Ready to ship
/pr                               # Claude drafts the PR for you
                                  # then: gh pr create (or use the URL)

# After PR is merged
git checkout main && git pull origin main
git branch -d feat/my-feature
```

### CI (`.github/workflows/ci.yml`)

Runs automatically on every push and PR to `main`:
- `bun run lint` — ESLint
- `bunx tsc --noEmit` — TypeScript type check
- `bun run test` — Vitest

The **build** job is opt-in: set the `CI_BUILD` repository variable to `true` in GitHub → Settings → Variables, and add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` as secrets. This lets Vercel handle production builds (it has the real secrets) while CI only checks correctness.

### Claude commands for git

| Command | What it does |
|---|---|
| `/commit [msg]` | Diffs changes, drafts a Conventional Commit message, pushes |
| `/pr [title]` | Creates a GitHub PR with summary + test plan filled in |
| `/sync [branch]` | Pulls latest from main, handles stash + rebase |
| `/review-pr <number>` | Reads the PR diff, reviews for correctness/types/invariants |

All git commands use `git -C /Users/user/Desktop/ielts-app` to work around the shell CWD restriction on the Desktop folder. If a command fails with a permission error, run the git command directly in your terminal.

### Secrets to configure in GitHub

Go to **Settings → Secrets and variables → Actions**:

| Secret | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `build` CI job |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `build` CI job |
| `MW_THESAURUS_API_KEY` | (optional) Merriam-Webster lookups |

## Key invariants

1. **Never mutate `SessionState` directly** — `rateCurrent`, `isFinished`, `summarize` return new values.
2. **SM-2 `ease` ≥ `MIN_EASE` (1.3) at all times** — enforced by `normalizeSettings` and `schedule`.
3. **`due_at` is always a UTC ISO string** in DB and session storage. Convert with `new Date(x).toISOString()` before storing.
4. **Word `synonyms` field is the source of truth** for all candidate state (verdict, note, sources). Never store synonyms elsewhere.
5. **`/api/lookup` is server-side only** — it guards behind Supabase auth and never exposes full context to providers (only the word + one neighbouring word each side).

## Database

Supabase PostgreSQL with RLS. Key tables:
- `words` — one row per term+sense; SM-2 state lives here
- `reviews` — append-only review history; updated via `record_review()` RPC
- `user_settings` — per-user `srs` JSONB (SM-2 parameter overrides)

Migrations live in `supabase/migrations/`. The `record_review` PL/pgSQL function atomically writes a review row and updates the word's SM-2 state.
