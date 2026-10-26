-- IELTS Vocabulary: initial schema.
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to run once on a new project.

-- ---------------------------------------------------------------------------
-- Words: one row per term + sense. A spelling can have several senses.
-- ---------------------------------------------------------------------------
create table public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  term text not null check (char_length(btrim(term)) between 1 and 120),
  -- Lowercased, whitespace-collapsed spelling used for duplicate detection.
  term_key text generated always as (lower(regexp_replace(btrim(term), '\s+', ' ', 'g'))) stored,
  source text not null check (source in ('reading', 'listening', 'general')),
  context text not null default '' check (char_length(context) <= 1000),

  meaning text not null default '' check (char_length(meaning) <= 1000),
  uzbek text not null default '' check (char_length(uzbek) <= 500),
  paraphrase text not null default '' check (char_length(paraphrase) <= 1000),
  example text not null default '' check (char_length(example) <= 1000),
  part_of_speech text not null default '' check (char_length(part_of_speech) <= 40),

  -- '' means "no dictionary sense chosen"; otherwise "pos|normalized definition".
  sense_key text not null default '' check (char_length(sense_key) <= 200),
  -- Selected sense: { provider, providerName, partOfSpeech, definition, example, sourceUrl, retrievedAt }
  sense jsonb,
  -- Synonym candidates: [{ word, label, basis, provider, providerName, sourceUrl, retrievedAt, verdict, note }]
  synonyms jsonb not null default '[]'::jsonb check (jsonb_typeof(synonyms) = 'array'),
  -- Pronunciation: { url, text, license: { name, url }, sourceUrl }
  audio jsonb,
  -- Provider status from the last lookup: { retrievedAt, providers: [{ id, name, url, status }] }
  lookup_meta jsonb,

  confidence smallint not null default 0 check (confidence between 0 and 5),
  status text not null default 'active' check (status in ('active', 'archived')),

  -- SM-2 scheduling state
  ease real not null default 2.5 check (ease >= 1.3 and ease <= 5),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index words_user_term_sense_key on public.words (user_id, term_key, sense_key);
create index words_user_due_idx on public.words (user_id, status, due_at);

-- ---------------------------------------------------------------------------
-- Review history (append-only from the app).
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_id uuid not null references public.words (id) on delete cascade,
  mode text not null check (char_length(mode) <= 30),
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  correct boolean,
  answer text check (char_length(answer) <= 1000),
  early boolean not null default false,
  prev_interval integer,
  new_interval integer,
  prev_ease real,
  new_ease real,
  prev_due_at timestamptz,
  new_due_at timestamptz,
  reviewed_at timestamptz not null default now()
);

create index reviews_word_idx on public.reviews (word_id, reviewed_at desc);
create index reviews_user_idx on public.reviews (user_id, reviewed_at desc);

-- ---------------------------------------------------------------------------
-- Per-user settings (adjustable SM-2 intervals).
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  srs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger words_touch before update on public.words
  for each row execute function public.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: every row is visible only to its owner.
-- ---------------------------------------------------------------------------
alter table public.words enable row level security;
alter table public.reviews enable row level security;
alter table public.user_settings enable row level security;

create policy "words: owner select" on public.words
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "words: owner insert" on public.words
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "words: owner update" on public.words
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "words: owner delete" on public.words
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "reviews: owner select" on public.reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reviews: owner insert" on public.reviews
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.words w where w.id = word_id and w.user_id = (select auth.uid()))
  );
create policy "reviews: owner delete" on public.reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "settings: owner select" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings: owner insert" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings: owner update" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- record_review: write the review and the new schedule in one transaction.
-- The schedule is computed in the app (src/lib/srs.js) so it is unit-tested
-- and uses the learner's local day boundaries. Runs with the caller's
-- permissions, so RLS still applies.
-- ---------------------------------------------------------------------------
create or replace function public.record_review(
  p_word_id uuid,
  p_mode text,
  p_rating text,
  p_correct boolean,
  p_answer text,
  p_early boolean,
  p_ease real,
  p_interval integer,
  p_repetitions integer,
  p_lapses integer,
  p_due_at timestamptz,
  p_confidence smallint,
  p_reviewed_at timestamptz default now()
)
returns public.words
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_row public.words;
  new_row public.words;
begin
  select * into old_row from public.words
    where id = p_word_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'word not found' using errcode = 'P0002';
  end if;

  update public.words set
    ease = p_ease,
    interval_days = p_interval,
    repetitions = p_repetitions,
    lapses = p_lapses,
    due_at = p_due_at,
    confidence = p_confidence,
    last_reviewed_at = p_reviewed_at
  where id = p_word_id
  returning * into new_row;

  insert into public.reviews (
    word_id, mode, rating, correct, answer, early,
    prev_interval, new_interval, prev_ease, new_ease, prev_due_at, new_due_at, reviewed_at
  ) values (
    p_word_id, p_mode, p_rating, p_correct, left(p_answer, 1000), coalesce(p_early, false),
    old_row.interval_days, p_interval, old_row.ease, p_ease, old_row.due_at, p_due_at, p_reviewed_at
  );

  return new_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: only signed-in users can reach these tables (RLS narrows to owner).
-- ---------------------------------------------------------------------------
revoke all on public.words, public.reviews, public.user_settings from anon;
grant select, insert, update, delete on public.words to authenticated;
grant select, insert, delete on public.reviews to authenticated;
grant select, insert, update on public.user_settings to authenticated;
revoke all on function public.record_review from public, anon;
grant execute on function public.record_review to authenticated;
