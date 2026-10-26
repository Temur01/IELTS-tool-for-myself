-- `ease` is a real, so the app's minimum of 1.3 is stored as 1.29999995 and
-- failed the original `ease >= 1.3` check. Allow for float rounding.
alter table public.words drop constraint if exists words_ease_check;
alter table public.words add constraint words_ease_check check (ease >= 1.29 and ease <= 5);
