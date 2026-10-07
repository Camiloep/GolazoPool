-- Flashscore sync cron jobs for GolazoPool
--
-- Prerequisites (run once from Dashboard → Database → Extensions):
--   enable pg_cron
--   enable pg_net
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor
--   2. Replace <INTERNAL_CRON_SECRET> with the value configured in Vercel
--      (paste it only in the editor; never commit the real value)
--   3. Run only the cron.schedule() calls below (not the extension commands)
--
-- To remove existing jobs before re-creating:
--   select cron.unschedule('flashscore-live-minutely');
--   select cron.unschedule('flashscore-results-hourly');
--   select cron.unschedule('flashscore-brackets-1h');


-- ─── 1. LIVE SCORES — every minute ───────────────────────────────────────────
-- Scrapes the Flashscore HTML page for matches currently in progress.
-- Updates home_score / away_score for in_progress matches in real time.
-- Low cost: fast HTTP fetch of a single HTML page.

select cron.schedule(
  'flashscore-live-minutely',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://golazopool.vercel.app/api/internal/flashscore/sync?mode=live',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-cron-secret', '<INTERNAL_CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);


-- ─── 2. FINAL RESULTS — every hour ───────────────────────────────────────────
-- Calls the SportDB API (Flashscore-backed) to mark matches as finished
-- and store the official final score.
-- This is the authoritative source for scoring predictions.

select cron.schedule(
  'flashscore-results-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://golazopool.vercel.app/api/internal/flashscore/sync?mode=results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-cron-secret', '<INTERNAL_CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);


-- ─── 3. KNOCKOUT BRACKET — every hour ────────────────────────────────────────
-- Resolves knockout teams: first the deterministic side from our group standings
-- ("1A"/"2B" as soon as a group finishes), then the rest from the Flashscore
-- bracket once a matchup is published. Idempotent and per-side: only fills a side
-- still null, so it never overwrites assignments or manual fixes. Cheap (one HTML
-- fetch). Runs at :30 to land just after the hourly results job (:00).

select cron.schedule(
  'flashscore-brackets-1h',
  '30 * * * *',
  $$
  select net.http_post(
    url     := 'https://golazopool.vercel.app/api/internal/flashscore/sync?mode=brackets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-cron-secret', '<INTERNAL_CRON_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
