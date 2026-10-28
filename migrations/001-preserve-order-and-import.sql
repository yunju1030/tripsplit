-- Additive only: keep all existing tables, IDs, rows and expense_splits amounts.
BEGIN;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS position INTEGER;
WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY trip_id ORDER BY id) - 1 AS n
  FROM public.members
)
UPDATE public.members m SET position = ordered.n FROM ordered
WHERE m.id = ordered.id AND m.position IS NULL;
ALTER TABLE public.members ALTER COLUMN position SET DEFAULT 0;
ALTER TABLE public.members ALTER COLUMN position SET NOT NULL;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS legacy_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS trips_legacy_id_unique ON public.trips (legacy_id) WHERE legacy_id IS NOT NULL;
COMMIT;
