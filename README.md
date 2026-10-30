# Fara — IELTS vocabulary practice

A mobile-first web app for capturing words from IELTS Reading, Listening and everyday English, choosing the
right sense, judging synonym candidates against your own sentence, and reviewing everything with spaced repetition.

**Stack:** Next.js 16 (App Router, JavaScript) · Bun (package manager) · Supabase Auth + Postgres with row-level security · plain CSS · Vitest.

## Features

- **Today:** due count, 5/10/15-minute sessions, resume an unfinished session, end-of-session summary, exam countdown.
- **Add word:** term, source (Reading / Listening / General English), context sentence, meaning, Uzbek translation,
  paraphrase, own example. **Check synonyms** looks up senses and candidates on the server.
- **Word list:** search, filter by source and status (new / learning / mastered / due / archived), export CSV,
  full JSON backup (words and review history).
- **Word detail:** meaning, paraphrase, highlighted context, selected sense with source link, synonym candidates
  with your verdicts and notes, pronunciation, review history, next due date, **Refresh**, archive, delete.
- **Learning modes:** recall, meaning → word, paraphrase, context cloze, type the answer (forgiving of case,
  punctuation and small typos), multiple choice with explanations, synonym in context, and a listen-and-type drill.
  Modes are chosen per word from the data available; new and difficult words get easier recognition modes, mature
  words get production modes.
- **Offline-tolerant:** if the connection drops mid-review, ratings are kept on the device and synced later.

### Spaced repetition (SM-2)

`src/lib/srs.js` uses SM-2 with four buttons. Hard, Good and Easy map to SM-2 quality 3, 4 and 5, and the ease
factor is updated with the SM-2 formula (minimum 1.3).

| Rating | New word | Second review | Later reviews |
| ------ | -------- | ------------- | ------------- |
| Again  | 10 min   | 10 min (lapse, reset) | 10 min (lapse, reset) |
| Hard   | 1 day    | prev × 1.2 (at least +1 day) | prev × 1.2 (at least +1 day) |
| Good   | 1 day    | 6 days        | prev × ease |
| Easy   | 4 days   | Good × 1.3    | Good × 1.3 |

Every value can be changed on **Settings**. Day intervals start at local midnight. Words missed in a session come
back a few cards later, at most twice. Practising a word **before** it is due is logged, but only **Again**
changes its schedule. Otherwise extra practice would inflate the interval.

### Dictionary providers

All lookups go through `GET /api/lookup` on the server. It requires a signed-in user and sends providers only the
term and the single word on each side of it in your sentence, never the full passage. Results are cached for
24 hours, and **Refresh** bypasses the cache. Nothing is polled in the background.

| Provider | Used for | Key | Notes |
| -------- | -------- | --- | ----- |
| [Free Dictionary API](https://dictionaryapi.dev/) | senses, part of speech, examples, per-sense synonyms, audio | none | Content from Wiktionary (CC BY-SA). Only audio files that state a licence are used, and the licence is shown. |
| [Datamuse](https://www.datamuse.com/api/) | related candidates (`rel_syn`, `ml`) | none today | `rel_syn` = same WordNet synset, sense unspecified. Datamuse says keys will be required from early 2027, at up to 100k requests/day. |
| [Merriam-Webster Thesaurus](https://dictionaryapi.com/) | per-sense synonyms | `MW_THESAURUS_API_KEY` (optional) | Free for non-commercial use, 1,000 queries/day per key. Monetising the app needs separate terms. |

Labels:

- **Near synonym:** the provider lists the word under the selected sense.
- **Related candidate:** everything else.

Nothing is labelled an exact synonym automatically. A candidate counts as a valid replacement, and appears in the
"synonym in context" quiz, only after you mark it **Fits**. To add a provider, implement the interface described in
`src/lib/dictionary/index.js`.

## Local setup

Requires [Bun](https://bun.sh) 1.2+ (for the text `bun.lock`) and Node.js 20.9+ (Next.js runs on it by default).

1. **Create a Supabase project** at <https://supabase.com> (the free tier is fine).
2. **Create the schema:** in Supabase, open **SQL Editor**, paste the contents of
   `supabase/migrations/0001_init.sql` and run it. This creates the `words`, `reviews` and `user_settings` tables,
   row-level-security policies so each account sees only its own rows, and the `record_review` function.
3. **Auth settings** (Authentication → URL Configuration):
   - Site URL: `http://localhost:3000` for now; change it to your domain later.
   - Redirect URLs: add `http://localhost:3000/auth/callback` (and your production URL later).
4. **Environment:** `cp .env.example .env.local`, then fill in `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API. Optionally add `MW_THESAURUS_API_KEY`.
5. Install and run:

   ```bash
   bun install
   bun run dev        # http://localhost:3000
   ```

6. Create your account on the sign-in page and confirm the email. **Then disable new sign-ups** (Authentication →
   Sign In / Providers → turn off "Allow new users to sign up") so nobody else can register.

### Checks

```bash
bun run test       # Vitest: scheduler, answer checking, senses/synonyms, providers, session flow, UI flows
bun run lint
bun run build
```

Use `bun run test`, not `bun test`: the latter starts Bun's own test runner instead of Vitest.

## Deploying to Vercel with your domain

1. Push the project to a GitHub repository (keep `.env.local` out of it; `.gitignore` already does this).
2. In Vercel, choose **Add New → Project**, import the repository, and keep the Next.js defaults. Vercel sees
   `bun.lock` and runs `bun install` automatically; no extra settings are needed.
3. **Environment variables** (Project → Settings → Environment Variables, for Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/publishable key. It is public by design and protected by RLS.
   - `MW_THESAURUS_API_KEY`: optional, server-only. It never reaches the browser.
   - `DATAMUSE_API_KEY`: optional; leave empty until Datamuse issues one.

   Never add the Supabase `service_role` key; the app doesn't need it.
4. Deploy, then add your domain under **Project → Settings → Domains**. Create the DNS records Vercel shows at your
   registrar (usually an `A` record for the apex domain and a `CNAME` for `www`) and wait for the certificate.
5. Back in Supabase (Authentication → URL Configuration), set **Site URL** to `https://your-domain` and add
   `https://your-domain/auth/callback` to Redirect URLs.
6. Sign in on the live site, add a word, then sign in on your phone and check that it appears.

**Optional: run the server code on Bun too.** By default Vercel installs with Bun but runs the functions on Node.js,
which is the stable option. Vercel's Bun runtime is in beta. To try it, add a `vercel.json` with
`{ "bunVersion": "1.x" }` and change the scripts to `"dev": "bun run --bun next dev"` and
`"build": "bun run --bun next build"`. This project builds and serves locally with `bun --bun next`.

## Project layout

```
src/app/                  pages (Today, add, words, words/[id], settings, login) and API routes
src/components/           UI: ReviewSession, ReviewCard (all modes), WordForm, SynonymPanel, …
src/lib/srs.js            SM-2 scheduler
src/lib/session.js        queue building, mode selection, in-session retries, summary
src/lib/answer.js         forgiving answer checks, cloze and neighbour extraction
src/lib/senses.js         sense ranking, candidate labelling/merging
src/lib/dictionary/       server-side providers + registry
src/lib/data.js           Supabase queries and offline review outbox
src/proxy.js              session refresh + sign-in redirect
supabase/migrations/      database schema and RLS
tests/                    Vitest suites
```

## Data notes

- Each saved item is one term **plus** one sense. The same spelling can be saved again with a different sense; the
  database rejects saving the same term and sense twice (`unique (user_id, term_key, sense_key)`).
- Reviews and schedule updates are written together by `record_review` in one transaction.
- Use **Backup JSON** on the Words page regularly. It includes all words and the full review history.
