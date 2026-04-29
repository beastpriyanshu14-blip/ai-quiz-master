-- 1. Add new columns to live_rooms
ALTER TABLE public.live_rooms
  ADD COLUMN IF NOT EXISTS max_participants integer,  -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS reveal_results boolean NOT NULL DEFAULT false;

-- 2. Lock down live_questions: hide correct_answer & explanation from non-hosts
DROP POLICY IF EXISTS questions_all ON public.live_questions;

-- Hosts can do everything (identified by host_token header)
CREATE POLICY questions_host_all ON public.live_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.live_rooms r
      WHERE r.id = live_questions.room_id
        AND r.host_token = current_setting('request.headers', true)::json->>'x-host-token'
    )
  )
  WITH CHECK (true);

-- Public can ONLY read via the safe view (defined below). Block direct reads.
-- (No SELECT policy => no rows visible to non-hosts.)

-- 3. Safe view exposing only question + options to participants
CREATE OR REPLACE VIEW public.live_questions_safe
WITH (security_invoker = false) AS
SELECT id, room_id, order_index, question, options
FROM public.live_questions;

GRANT SELECT ON public.live_questions_safe TO anon, authenticated;

-- 4. Server-side answer submission (validates correct_answer in DB, never to client)
CREATE OR REPLACE FUNCTION public.submit_live_answer(
  p_room_id uuid,
  p_question_id uuid,
  p_participant_token text,
  p_selected text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.live_rooms;
  v_q public.live_questions;
  v_participant public.live_participants;
  v_elapsed_ms integer;
  v_total_ms integer;
  v_is_correct boolean;
  v_points integer;
  v_existing uuid;
BEGIN
  SELECT * INTO v_room FROM public.live_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','room not found'); END IF;
  IF v_room.status <> 'active' THEN RETURN jsonb_build_object('error','quiz not active'); END IF;
  IF v_room.question_started_at IS NULL THEN RETURN jsonb_build_object('error','question not started'); END IF;

  SELECT * INTO v_q FROM public.live_questions
    WHERE id = p_question_id AND room_id = p_room_id
      AND order_index = v_room.current_question_index;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','wrong question'); END IF;

  SELECT * INTO v_participant FROM public.live_participants
    WHERE room_id = p_room_id AND participant_token = p_participant_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not a participant'); END IF;
  IF v_participant.is_kicked THEN RETURN jsonb_build_object('error','kicked'); END IF;

  -- Prevent duplicate submission for this question
  SELECT id INTO v_existing FROM public.live_answers
    WHERE room_id = p_room_id
      AND participant_id = v_participant.id
      AND question_order_index = v_room.current_question_index;
  IF FOUND THEN RETURN jsonb_build_object('error','already answered'); END IF;

  v_total_ms := v_room.seconds_per_question * 1000;
  v_elapsed_ms := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_room.question_started_at))::integer * 1000);

  -- Lock answers after timer (small grace of 1500ms for network)
  IF v_elapsed_ms > v_total_ms + 1500 THEN
    RETURN jsonb_build_object('error','time up');
  END IF;

  v_is_correct := (p_selected IS NOT NULL AND p_selected = v_q.correct_answer);

  IF v_is_correct THEN
    v_points := 500 + ROUND(500 * GREATEST(0, 1 - v_elapsed_ms::numeric / GREATEST(1, v_total_ms)));
  ELSE
    v_points := 0;
  END IF;

  INSERT INTO public.live_answers
    (room_id, question_id, participant_id, question_order_index, selected_answer, is_correct, time_taken_ms, points_earned)
  VALUES
    (p_room_id, p_question_id, v_participant.id, v_room.current_question_index, p_selected, v_is_correct, v_elapsed_ms, v_points);

  UPDATE public.live_participants
    SET score = score + v_points, last_seen_at = now()
    WHERE id = v_participant.id;

  -- Do NOT return correctness during quiz (kept private until reveal)
  RETURN jsonb_build_object('ok', true, 'locked', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_live_answer TO anon, authenticated;

-- 5. Atomic join with capacity check
CREATE OR REPLACE FUNCTION public.join_live_room(
  p_code text,
  p_password text,
  p_display_name text,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.live_rooms;
  v_count integer;
  v_existing public.live_participants;
  v_new_id uuid;
BEGIN
  IF length(coalesce(p_display_name,'')) < 2 THEN RETURN jsonb_build_object('error','name too short'); END IF;

  SELECT * INTO v_room FROM public.live_rooms WHERE code = upper(p_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('error','room not found'); END IF;
  IF v_room.password <> p_password THEN RETURN jsonb_build_object('error','wrong password'); END IF;
  IF v_room.status = 'ended' THEN RETURN jsonb_build_object('error','room ended'); END IF;

  -- Existing token => rejoin
  SELECT * INTO v_existing FROM public.live_participants
    WHERE room_id = v_room.id AND participant_token = p_token;
  IF FOUND THEN
    IF v_existing.is_kicked THEN RETURN jsonb_build_object('error','kicked'); END IF;
    RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'participant_id', v_existing.id, 'rejoined', true);
  END IF;

  -- Duplicate display name?
  IF EXISTS (SELECT 1 FROM public.live_participants
             WHERE room_id = v_room.id AND lower(display_name) = lower(p_display_name) AND NOT is_kicked) THEN
    RETURN jsonb_build_object('error','name taken');
  END IF;

  -- Capacity
  SELECT count(*) INTO v_count FROM public.live_participants
    WHERE room_id = v_room.id AND NOT is_kicked;
  IF v_room.max_participants IS NOT NULL AND v_count >= v_room.max_participants THEN
    RETURN jsonb_build_object('error','room full');
  END IF;

  -- Lobby only (cannot join a quiz already in progress)
  IF v_room.status <> 'lobby' THEN
    RETURN jsonb_build_object('error','quiz already started');
  END IF;

  INSERT INTO public.live_participants (room_id, participant_token, display_name)
    VALUES (v_room.id, p_token, p_display_name)
    RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'room_id', v_room.id, 'participant_id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_live_room TO anon, authenticated;

-- 6. Touch updated_at trigger on live_rooms (if not present)
DROP TRIGGER IF EXISTS trg_live_rooms_touch ON public.live_rooms;
CREATE TRIGGER trg_live_rooms_touch BEFORE UPDATE ON public.live_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();