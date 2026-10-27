Write or explain a Supabase query for this app. The request is: $ARGUMENTS

This app uses Supabase PostgreSQL with Row Level Security. Key schema facts:

- `words` table: `id uuid`, `user_id uuid`, `term text`, `term_key text` (lowercased, for dedup), `source text`, `context text`, `meaning text`, `uzbek text`, `paraphrase text`, `example text`, `part_of_speech text`, `sense_key text`, `sense jsonb`, `synonyms jsonb` (array of Synonym objects), `audio jsonb`, `lookup_meta jsonb`, `status text`, SM-2 fields: `ease float8`, `interval_days int`, `repetitions int`, `lapses int`, `confidence int`, `due_at timestamptz`, `last_reviewed_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz`
- `reviews` table: `id uuid`, `word_id uuid`, `mode text`, `rating text`, `correct bool`, `answer text`, `early bool`, SM-2 prev/new columns, `due_at timestamptz`, `reviewed_at timestamptz`
- `user_settings` table: `user_id uuid`, `srs jsonb`
- RLS: all tables filtered by `user_id = auth.uid()`
- `record_review(p_word_id, p_mode, p_rating, ...)` — PL/pgSQL function that atomically writes review + updates word SM-2 state

The client is a `SupabaseClient` from `@supabase/supabase-js`. Queries go through `src/lib/data.ts` using the `run()` helper which throws on error.

For any new query:
1. Write the TypeScript code using the existing `getSupabase()` pattern
2. Show the equivalent raw SQL for understanding
3. Confirm RLS is respected (no `user_id` filter needed in client code — RLS handles it)
4. Add the function to `src/lib/data.ts` with correct return type from `src/lib/types.ts`
