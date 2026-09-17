-- Anchor each simulation to a fixed start month/year.
-- This prevents month-specific overrides from shifting when calendar month changes.

ALTER TABLE public.simulations
ADD COLUMN IF NOT EXISTS start_year INTEGER,
ADD COLUMN IF NOT EXISTS start_month INTEGER;

-- Backfill existing simulations using "month after creation" as anchor.
UPDATE public.simulations
SET
  start_year = EXTRACT(YEAR FROM (date_trunc('month', created_at) + INTERVAL '1 month'))::INTEGER,
  start_month = EXTRACT(MONTH FROM (date_trunc('month', created_at) + INTERVAL '1 month'))::INTEGER
WHERE start_year IS NULL OR start_month IS NULL;

-- Constraints for data safety.
ALTER TABLE public.simulations
ADD CONSTRAINT simulations_start_month_check
CHECK (start_month IS NULL OR (start_month >= 1 AND start_month <= 12));

