-- Live rooms
CREATE TABLE public.live_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  host_token TEXT NOT NULL,
  host_name TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'lobby', -- lobby | active | paused | ended
  current_question_index INTEGER NOT NULL DEFAULT -1,
  question_started_at TIMESTAMPTZ,
  seconds_per_question INTEGER NOT NULL DEFAULT 20,
  total_questions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.live_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, order_index)
);

CREATE TABLE public.live_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  participant_token TEXT NOT NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_kicked BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, participant_token),
  UNIQUE(room_id, display_name)
);

CREATE TABLE public.live_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.live_questions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.live_participants(id) ON DELETE CASCADE,
  question_order_index INTEGER NOT NULL,
  selected_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  time_taken_ms INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_id, participant_id)
);

CREATE INDEX idx_live_questions_room ON public.live_questions(room_id, order_index);
CREATE INDEX idx_live_participants_room ON public.live_participants(room_id);
CREATE INDEX idx_live_answers_room_q ON public.live_answers(room_id, question_order_index);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER live_rooms_touch
BEFORE UPDATE ON public.live_rooms
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_answers ENABLE ROW LEVEL SECURITY;

-- Open policies (no auth in app; security is via room code + password + tokens)
CREATE POLICY "rooms_all" ON public.live_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "questions_all" ON public.live_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "participants_all" ON public.live_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "answers_all" ON public.live_answers FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER TABLE public.live_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.live_questions REPLICA IDENTITY FULL;
ALTER TABLE public.live_participants REPLICA IDENTITY FULL;
ALTER TABLE public.live_answers REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_answers;