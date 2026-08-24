-- 1. AI category override: a creator can lock in (or clear) the third, AI-contributed
--    category label so a later "regenerate DNA" never silently overwrites their choice.
ALTER TABLE public.creator_profiles
  ADD COLUMN ai_category text,
  ADD COLUMN ai_category_locked boolean NOT NULL DEFAULT false;

-- 2. Consolidate on conversation_messages — public.messages was the legacy/parallel
--    messaging table, superseded by conversations/conversation_messages, unused (0 rows)
--    except one read (brand activity indicator, migrated to conversation_messages).
DROP TABLE IF EXISTS public.messages;
