
-- =========================================================================
-- 1) Drop old permissive policies
-- =========================================================================
DROP POLICY IF EXISTS rooms_all ON public.live_rooms;
DROP POLICY IF EXISTS participants_all ON public.live_participants;
DROP POLICY IF EXISTS answers_all ON public.live_answers;
DROP POLICY IF EXISTS questions_host_all ON public.live_questions;

-- =========================================================================
-- 2) Helper: read host token from request headers
-- =========================================================================
CREATE OR REPLACE FUNCTION public._req_host_token()
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT NULLIF(((current_setting('request.headers', true))::json ->> 'x-host-token'), '');
$$;

CREATE OR REPLACE FUNCTION public._req_participant_token()
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT NULLIF(((current_setting('request.headers', true))::json ->> 'x-participant-token'), '');
$$;

-- =========================================================================
-- 3) live_rooms — lock down
--    SELECT: only host (via x-host-token) can read full row.
--    No INSERT/UPDATE/DELETE from clients (RPCs only).
-- =========================================================================
CREATE POLICY rooms_host_select ON public.live_rooms
  FOR SELECT
  USING (host_token IS NOT NULL AND host_token = public._req_host_token());

-- Public-readable view that excludes password and host_token
CREATE OR REPLACE VIEW public.live_rooms_public
WITH (security_invoker = true) AS
SELECT
  id, code, host_name, topic, difficulty,
  status, current_question_index, question_started_at,
  seconds_per_question, total_questions, max_participants,
  reveal_results, created_at, updated_at
FROM public.live_rooms;

-- The view must bypass RLS for SELECT of non-sensitive fields. We do that by
-- granting access to a SECURITY DEFINER set-returning function.
CREATE OR REPLACE FUNCTION public.get_room_public(p_room_id uuid)
RETURNS TABLE (
  id uuid, code text, host_name text, topic text, difficulty text,
  status text, current_question_index integer, question_started_at timestamptz,
  seconds_per_question integer, total_questions integer, max_participants integer,
  reveal_results boolean, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, code, host_name, topic, difficulty, status, current_question_index,
         question_started_at, seconds_per_question, total_questions, max_participants,
         reveal_results, created_at, updated_at
  FROM public.live_rooms WHERE id = p_room_id;
$$;

CREATE OR REPLACE FUNCTION public.get_room_public_by_code(p_code text)
RETURNS TABLE (
  id uuid, code text, host_name text, topic text, difficulty text,
  status text, current_question_index integer, question_started_at timestamptz,
  seconds_per_question integer, total_questions integer, max_participants integer,
  reveal_results boolean, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, code, host_name, topic, difficulty, status, current_question_index,
         question_started_at, seconds_per_question, total_questions, max_participants,
         reveal_results, created_at, updated_at
  FROM public.live_rooms WHERE code = upper(p_code);
$$;

-- =========================================================================
-- 4) live_participants — lock down writes; allow SELECT (leaderboard)
--    is_kicked is a flag participants need to read for themselves.
--    Score and display_name need to be readable by everyone in the room.
-- =========================================================================
CREATE POLICY participants_select ON public.live_participants
  FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policies => denied for clients (RPCs use SECURITY DEFINER)

-- Restrict columns readable: participant_token must NOT leak to other players.
-- Since column-level RLS isn't trivial here, expose a safe view and revoke direct access.
REVOKE SELECT ON public.live_participants FROM anon, authenticated;

CREATE OR REPLACE VIEW public.live_participants_public
WITH (security_invoker = true) AS
SELECT id, room_id, display_name, score, is_kicked, joined_at, last_seen_at
FROM public.live_participants;

GRANT SELECT ON public.live_participants_public TO anon, authenticated;

-- =========================================================================
-- 5) live_answers — block direct writes; allow SELECT for in-room visibility
--    (host needs counts, players need their own results).
--    Writes go through submit_live_answer RPC.
-- =========================================================================
CREATE POLICY answers_select ON public.live_answers
  FOR SELECT USING (true);
-- No write policies.

-- =========================================================================
-- 6) live_questions — host-only direct access; safe view for participants
-- =========================================================================
CREATE POLICY questions_host_select ON public.live_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_rooms r
      WHERE r.id = live_questions.room_id
        AND r.host_token = public._req_host_token()
    )
  );
-- No INSERT/UPDATE/DELETE policies — only RPCs (SECURITY DEFINER) write.

-- Replace unsafe view: now uses security_invoker=true and a participant-aware
-- policy via underlying RLS check inside a SECURITY DEFINER function.
DROP VIEW IF EXISTS public.live_questions_safe;

CREATE OR REPLACE FUNCTION public.get_room_questions_safe(p_room_id uuid)
RETURNS TABLE (
  id uuid, room_id uuid, order_index integer, question text, options jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_token text := public._req_host_token();
  v_part_token text := public._req_participant_token();
  v_authorized boolean := false;
BEGIN
  -- Host?
  IF v_host_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.live_rooms r WHERE r.id = p_room_id AND r.host_token = v_host_token
  ) THEN
    v_authorized := true;
  END IF;

  -- Participant of this room?
  IF NOT v_authorized AND v_part_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.live_participants p
    WHERE p.room_id = p_room_id AND p.participant_token = v_part_token AND NOT p.is_kicked
  ) THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT q.id, q.room_id, q.order_index, q.question, q.options
    FROM public.live_questions q
    WHERE q.room_id = p_room_id
    ORDER BY q.order_index;
END;
$$;

-- =========================================================================
-- 7) Host action RPCs (server-validated)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._assert_host(p_room_id uuid, p_host_token text)
RETURNS public.live_rooms
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE r public.live_rooms;
BEGIN
  SELECT * INTO r FROM public.live_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'room not found'; END IF;
  IF r.host_token IS NULL OR r.host_token <> p_host_token THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.host_advance_question(p_room_id uuid, p_host_token text, p_index integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.live_rooms;
BEGIN
  r := public._assert_host(p_room_id, p_host_token);
  IF p_index >= r.total_questions THEN
    UPDATE public.live_rooms SET status = 'ended', updated_at = now() WHERE id = p_room_id;
    RETURN jsonb_build_object('ok', true, 'ended', true);
  END IF;
  UPDATE public.live_rooms
    SET status = 'active',
        current_question_index = p_index,
        question_started_at = now(),
        updated_at = now()
    WHERE id = p_room_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.host_pause(p_room_id uuid, p_host_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_host(p_room_id, p_host_token);
  UPDATE public.live_rooms SET status = 'paused', updated_at = now() WHERE id = p_room_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.host_resume(p_room_id uuid, p_host_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_host(p_room_id, p_host_token);
  UPDATE public.live_rooms
    SET status = 'active', question_started_at = now(), updated_at = now()
    WHERE id = p_room_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.host_end(p_room_id uuid, p_host_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_host(p_room_id, p_host_token);
  UPDATE public.live_rooms SET status = 'ended', updated_at = now() WHERE id = p_room_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.host_reveal(p_room_id uuid, p_host_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_host(p_room_id, p_host_token);
  UPDATE public.live_rooms
    SET status = 'ended', reveal_results = true, updated_at = now()
    WHERE id = p_room_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.host_kick(p_room_id uuid, p_host_token text, p_participant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_host(p_room_id, p_host_token);
  UPDATE public.live_participants SET is_kicked = true
    WHERE id = p_participant_id AND room_id = p_room_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Host: fetch full room (with password), questions including answers
CREATE OR REPLACE FUNCTION public.host_get_room(p_room_id uuid, p_host_token text)
RETURNS public.live_rooms LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.live_rooms;
BEGIN
  r := public._assert_host(p_room_id, p_host_token);
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.host_get_questions(p_room_id uuid, p_host_token text)
RETURNS TABLE (
  id uuid, room_id uuid, order_index integer, question text,
  options jsonb, correct_answer text, explanation text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_host(p_room_id, p_host_token);
  RETURN QUERY
    SELECT q.id, q.room_id, q.order_index, q.question, q.options, q.correct_answer, q.explanation
    FROM public.live_questions q
    WHERE q.room_id = p_room_id
    ORDER BY q.order_index;
END;
$$;

-- =========================================================================
-- 8) Lock down EXECUTE on existing internal helpers (not meant to be public RPCs)
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public._assert_host(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._req_host_token() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._req_participant_token() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;

-- Grant explicit EXECUTE for public RPCs
GRANT EXECUTE ON FUNCTION public.create_live_room(text,text,text,text,text,text,integer,integer,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_live_room(text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_live_answer(uuid,uuid,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_advance_question(uuid,text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_pause(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_resume(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_end(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_reveal(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_kick(uuid,text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_get_room(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_get_questions(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_public_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_room_questions_safe(uuid) TO anon, authenticated;
