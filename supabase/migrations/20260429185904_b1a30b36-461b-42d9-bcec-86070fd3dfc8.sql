CREATE OR REPLACE FUNCTION public.create_live_room(
  p_code text,
  p_password text,
  p_host_token text,
  p_host_name text,
  p_topic text,
  p_difficulty text,
  p_seconds_per_question integer,
  p_max_participants integer,
  p_questions jsonb  -- [{question, options[4], correct_answer, explanation}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_count integer;
  v_q jsonb;
  v_idx integer := 0;
BEGIN
  IF length(coalesce(p_password,'')) < 4 THEN RETURN jsonb_build_object('error','password too short'); END IF;
  IF p_seconds_per_question < 5 OR p_seconds_per_question > 600 THEN
    RETURN jsonb_build_object('error','invalid timer');
  END IF;
  IF p_max_participants IS NOT NULL AND (p_max_participants < 1 OR p_max_participants > 1000) THEN
    RETURN jsonb_build_object('error','invalid max participants');
  END IF;
  IF p_difficulty NOT IN ('easy','medium','hard') THEN
    RETURN jsonb_build_object('error','invalid difficulty');
  END IF;

  v_count := jsonb_array_length(p_questions);
  IF v_count < 1 OR v_count > 200 THEN
    RETURN jsonb_build_object('error','question count out of range');
  END IF;

  INSERT INTO public.live_rooms
    (code, password, host_token, host_name, topic, difficulty, seconds_per_question, total_questions, max_participants)
  VALUES
    (upper(p_code), p_password, p_host_token, p_host_name, p_topic, p_difficulty, p_seconds_per_question, v_count, p_max_participants)
  RETURNING id INTO v_room_id;

  FOR v_q IN SELECT * FROM jsonb_array_elements(p_questions) LOOP
    IF (v_q->>'question') IS NULL OR length(trim(v_q->>'question')) = 0 THEN
      RAISE EXCEPTION 'question text required';
    END IF;
    IF jsonb_array_length(v_q->'options') <> 4 THEN
      RAISE EXCEPTION 'each question needs exactly 4 options';
    END IF;
    IF (v_q->>'correct_answer') IS NULL THEN
      RAISE EXCEPTION 'correct answer required';
    END IF;

    INSERT INTO public.live_questions
      (room_id, order_index, question, options, correct_answer, explanation)
    VALUES
      (v_room_id, v_idx, v_q->>'question', v_q->'options', v_q->>'correct_answer', coalesce(v_q->>'explanation',''));
    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'room_id', v_room_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_live_room TO anon, authenticated;