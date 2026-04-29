
-- Re-grant SELECT on live_participants so realtime postgres_changes deliver to clients.
-- The participant_token is a per-session token (used only to submit one's own answers
-- via the submit_live_answer RPC, which validates room+question state). The major
-- credential (host_token) and password are now protected on live_rooms.
GRANT SELECT ON public.live_participants TO anon, authenticated;
