CREATE OR REPLACE FUNCTION public.get_room_questions_safe(p_room_id uuid, p_participant_token text DEFAULT NULL)
 RETURNS TABLE(id uuid, room_id uuid, order_index integer, question text, options jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host_token text := public._req_host_token();
  v_part_token text := COALESCE(p_participant_token, public._req_participant_token());
  v_authorized boolean := false;
BEGIN
  IF v_host_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.live_rooms r WHERE r.id = p_room_id AND r.host_token = v_host_token
  ) THEN
    v_authorized := true;
  END IF;

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
$function$;