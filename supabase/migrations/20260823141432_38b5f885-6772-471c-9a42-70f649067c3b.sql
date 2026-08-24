REVOKE EXECUTE ON FUNCTION public.can_message_user(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_message_user(uuid, uuid, text) TO service_role;