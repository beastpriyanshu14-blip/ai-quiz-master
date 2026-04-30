-- Recreate live_participants_public with security_invoker so it doesn't bypass RLS
DROP VIEW IF EXISTS public.live_participants_public;
CREATE VIEW public.live_participants_public
WITH (security_invoker = true) AS
  SELECT id, room_id, display_name, score, correct_answers, is_kicked, joined_at, last_seen_at
  FROM public.live_participants;
GRANT SELECT ON public.live_participants_public TO anon, authenticated;

-- Replace the answers SELECT policy with a strict deny (clients use RPCs).
DROP POLICY IF EXISTS answers_select ON public.live_answers;
DROP POLICY IF EXISTS answers_select_own_or_revealed ON public.live_answers;

-- No SELECT policy => no client can read live_answers directly.
-- All reads happen via SECURITY DEFINER RPCs that validate identity.

-- RPC: a participant fetches only their own answers in a room.
CREATE OR REPLACE FUNCTION public.get_my_answers(
  p_room_id uuid,
  p_participant_token text
)
RETURNS SETOF public.live_answers
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM public.live_participants
   WHERE room_id = p_room_id AND participant_token = p_participant_token;
  IF v_pid IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM public.live_answers
                WHERE room_id = p_room_id AND participant_id = v_pid;
END;
$$;

-- RPC: after the host reveals results, any in-room participant can read all answers.
CREATE OR REPLACE FUNCTION public.get_revealed_answers(
  p_room_id uuid,
  p_participant_token text
)
RETURNS SETOF public.live_answers
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_revealed boolean;
BEGIN
  SELECT (reveal_results AND status = 'ended') INTO v_revealed
    FROM public.live_rooms WHERE id = p_room_id;
  IF NOT COALESCE(v_revealed, false) THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.live_participants
     WHERE room_id = p_room_id AND participant_token = p_participant_token
       AND NOT is_kicked
  ) THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM public.live_answers WHERE room_id = p_room_id;
END;
$$;

-- Remove live_answers from realtime publication: clients now poll via RPCs and
-- the existing 1s polling already covers UI updates. Keeping it in realtime
-- would re-leak per-row correctness/points to anyone subscribing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_answers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.live_answers';
  END IF;
END $$;