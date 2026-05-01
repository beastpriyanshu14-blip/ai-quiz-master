-- Return a single JSON object so the client always gets a usable shape.
DROP FUNCTION IF EXISTS public.get_room_public(uuid);

CREATE OR REPLACE FUNCTION public.get_room_public(p_room_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(r) INTO result
  FROM (
    SELECT
      id,
      code,
      host_name,
      topic,
      difficulty,
      status,
      current_question_index,
      question_started_at,
      seconds_per_question,
      total_questions,
      max_participants,
      reveal_results,
      created_at,
      updated_at
    FROM public.live_rooms
    WHERE id = p_room_id
  ) r;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_public(uuid) TO anon, authenticated;

-- Recreate the safe-questions RPC. Keeps the same column shape the frontend
-- already expects (order_index), but now also accepts host token via header
-- so HostRoom keeps working, gates on quiz having started, and validates the
-- participant token explicitly passed by the client.
DROP FUNCTION IF EXISTS public.get_room_questions_safe(uuid, text);
DROP FUNCTION IF EXISTS public.get_room_questions_safe(uuid);

CREATE OR REPLACE FUNCTION public.get_room_questions_safe(
  p_room_id uuid,
  p_participant_token text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  room_id uuid,
  order_index int,
  question text,
  options jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_token text := public._req_host_token();
  v_part_token text := COALESCE(p_participant_token, public._req_participant_token());
  v_authorized boolean := false;
  v_status text;
BEGIN
  -- Host of this room?
  IF v_host_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.live_rooms r
    WHERE r.id = p_room_id AND r.host_token = v_host_token
  ) THEN
    v_authorized := true;
  END IF;

  -- Participant of this room?
  IF NOT v_authorized AND v_part_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.live_participants p
    WHERE p.room_id = p_room_id
      AND p.participant_token = v_part_token
      AND NOT p.is_kicked
  ) THEN
    v_authorized := true;
  END IF;

  IF NOT v_authorized THEN
    RETURN;
  END IF;

  -- For participants, only return questions once the quiz has started.
  -- Hosts can see questions any time.
  IF v_host_token IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.live_rooms r
    WHERE r.id = p_room_id AND r.host_token = v_host_token
  ) THEN
    SELECT status INTO v_status FROM public.live_rooms WHERE id = p_room_id;
    IF v_status NOT IN ('active', 'paused', 'ended') THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
    SELECT q.id, q.room_id, q.order_index, q.question, q.options
    FROM public.live_questions q
    WHERE q.room_id = p_room_id
    ORDER BY q.order_index;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_questions_safe(uuid, text) TO anon, authenticated;