-- =========================================================================
-- 1) live_answers: restrict per-player visibility before reveal
-- =========================================================================
DROP POLICY IF EXISTS answers_select ON public.live_answers;

-- A participant can read only their own answers, unless the host has revealed
-- results for the room (then everyone in the room can see all answers for analytics).
CREATE POLICY answers_select_own_or_revealed
  ON public.live_answers
  FOR SELECT
  USING (
    -- Own answer: participant_token header matches the row's participant
    EXISTS (
      SELECT 1 FROM public.live_participants p
      WHERE p.id = live_answers.participant_id
        AND p.participant_token = public._req_participant_token()
    )
    OR
    -- After reveal, anyone in the room can see all answers
    EXISTS (
      SELECT 1 FROM public.live_rooms r
      WHERE r.id = live_answers.room_id
        AND r.reveal_results = true
        AND r.status = 'ended'
    )
    OR
    -- Host can see all answers in their own room
    EXISTS (
      SELECT 1 FROM public.live_rooms r
      WHERE r.id = live_answers.room_id
        AND r.host_token IS NOT NULL
        AND r.host_token = public._req_host_token()
    )
  );

-- =========================================================================
-- 2) Server-side RPC for host to fetch all answers in their room
--    (host_token is not always sent as a header from the client; pass explicitly)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.host_get_answers(
  p_room_id uuid,
  p_host_token text
)
RETURNS SETOF public.live_answers
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_host(p_room_id, p_host_token);
  RETURN QUERY
    SELECT * FROM public.live_answers WHERE room_id = p_room_id;
END;
$$;

-- =========================================================================
-- 3) Drop unused SECURITY DEFINER-style view (lint: 0010_security_definer_view)
--    Participants fetch questions via get_room_questions_safe RPC instead.
-- =========================================================================
DROP VIEW IF EXISTS public.live_questions_safe;

-- =========================================================================
-- 4) question_sets: add explicit deny-all policies (lint: 0008_rls_enabled_no_policy)
--    Documents intent: no direct client access; all reads/writes go through
--    SECURITY DEFINER RPCs (list_question_sets / upsert_question_set / delete_question_set).
-- =========================================================================
DROP POLICY IF EXISTS question_sets_no_direct_select ON public.question_sets;
DROP POLICY IF EXISTS question_sets_no_direct_insert ON public.question_sets;
DROP POLICY IF EXISTS question_sets_no_direct_update ON public.question_sets;
DROP POLICY IF EXISTS question_sets_no_direct_delete ON public.question_sets;

CREATE POLICY question_sets_no_direct_select
  ON public.question_sets FOR SELECT USING (false);
CREATE POLICY question_sets_no_direct_insert
  ON public.question_sets FOR INSERT WITH CHECK (false);
CREATE POLICY question_sets_no_direct_update
  ON public.question_sets FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY question_sets_no_direct_delete
  ON public.question_sets FOR DELETE USING (false);

-- Belt-and-braces: ensure direct table access is revoked for client roles.
REVOKE ALL ON public.question_sets FROM anon, authenticated;