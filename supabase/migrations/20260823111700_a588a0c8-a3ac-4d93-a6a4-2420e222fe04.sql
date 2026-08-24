REVOKE EXECUTE ON FUNCTION public.is_conversation_party(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_party(uuid, uuid) TO authenticated, service_role;