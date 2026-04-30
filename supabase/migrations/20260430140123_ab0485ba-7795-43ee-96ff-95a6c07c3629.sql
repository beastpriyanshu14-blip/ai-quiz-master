-- Remove sensitive tables from the realtime publication.
-- Realtime postgres_changes can leak full row payloads (including columns
-- like host_token, password, correct_answer, explanation) to channel
-- subscribers, bypassing column-level expectations of our RLS model.
-- The app already polls these via SECURITY DEFINER RPCs, so dropping
-- them from realtime is safe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_rooms'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.live_rooms';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_questions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.live_questions';
  END IF;
END $$;