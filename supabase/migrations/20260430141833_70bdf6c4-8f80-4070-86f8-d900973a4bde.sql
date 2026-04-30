-- 1. Add correct_answers column to live_participants
ALTER TABLE public.live_participants
  ADD COLUMN IF NOT EXISTS correct_answers integer NOT NULL DEFAULT 0;

-- Recreate the public view to include correct_answers
DROP VIEW IF EXISTS public.live_participants_public;
CREATE VIEW public.live_participants_public AS
  SELECT id, room_id, display_name, score, correct_answers, is_kicked, joined_at, last_seen_at
  FROM public.live_participants;

-- Backfill correct_answers from existing answers
UPDATE public.live_participants p
   SET correct_answers = sub.cnt
  FROM (
    SELECT participant_id, count(*)::int AS cnt
      FROM public.live_answers
      WHERE is_correct = true
      GROUP BY participant_id
  ) sub
 WHERE sub.participant_id = p.id;

-- 2. Update submit_live_answer to increment correct_answers
CREATE OR REPLACE FUNCTION public.submit_live_answer(p_room_id uuid, p_question_id uuid, p_participant_token text, p_selected text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT id INTO v_existing FROM public.live_answers
    WHERE room_id = p_room_id
      AND participant_id = v_participant.id
      AND question_order_index = v_room.current_question_index;
  IF FOUND THEN RETURN jsonb_build_object('error','already answered'); END IF;

  v_total_ms := v_room.seconds_per_question * 1000;
  v_elapsed_ms := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_room.question_started_at))::integer * 1000);

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
    SET score = score + v_points,
        correct_answers = correct_answers + (CASE WHEN v_is_correct THEN 1 ELSE 0 END),
        last_seen_at = now()
    WHERE id = v_participant.id;

  RETURN jsonb_build_object('ok', true, 'locked', true);
END;
$function$;

-- 3. Question Sets table (anonymous host_id token from localStorage)
CREATE TABLE IF NOT EXISTS public.question_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id text NOT NULL,
  name text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_sets_host ON public.question_sets(host_id, created_at DESC);

ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;

-- All access goes through SECURITY DEFINER RPCs that validate host_id.
-- Default: no direct table access from anon role.

CREATE OR REPLACE FUNCTION public.list_question_sets(p_host_id text)
 RETURNS TABLE(id uuid, name text, questions jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, questions, created_at, updated_at
  FROM public.question_sets
  WHERE host_id = p_host_id
  ORDER BY updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.upsert_question_set(p_host_id text, p_id uuid, p_name text, p_questions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_count integer;
BEGIN
  IF length(coalesce(p_host_id, '')) < 8 THEN RETURN jsonb_build_object('error','invalid host'); END IF;
  IF length(trim(coalesce(p_name, ''))) < 1 THEN RETURN jsonb_build_object('error','name required'); END IF;
  v_count := jsonb_array_length(p_questions);
  IF v_count < 1 OR v_count > 200 THEN RETURN jsonb_build_object('error','question count out of range'); END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.question_sets (host_id, name, questions)
    VALUES (p_host_id, p_name, p_questions)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.question_sets
       SET name = p_name, questions = p_questions, updated_at = now()
     WHERE id = p_id AND host_id = p_host_id
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('error','not found'); END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_question_set(p_host_id text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_deleted int;
BEGIN
  DELETE FROM public.question_sets WHERE id = p_id AND host_id = p_host_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', v_deleted > 0);
END;
$$;