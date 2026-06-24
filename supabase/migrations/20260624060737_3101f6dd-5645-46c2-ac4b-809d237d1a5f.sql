
-- =========================================================
-- CONNECTIONS (LinkedIn-style mutual connections)
-- =========================================================
CREATE TYPE public.connection_status AS ENUM ('pending','accepted','declined');

CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.connection_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own connections" ON public.connections
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Send connection request" ON public.connections
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Respond to connection" ON public.connections
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "Delete own connection" ON public.connections
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE TRIGGER trg_connections_updated
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_connections_requester ON public.connections(requester_id, status);
CREATE INDEX idx_connections_addressee ON public.connections(addressee_id, status);

-- =========================================================
-- MESSAGES (1:1 DMs)
-- =========================================================
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Send message to connection" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.status = 'accepted'
        AND ((c.requester_id = auth.uid() AND c.addressee_id = recipient_id)
          OR (c.addressee_id = auth.uid() AND c.requester_id = recipient_id))
    )
  );
CREATE POLICY "Mark received messages read" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE INDEX idx_messages_thread ON public.messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_messages_recipient ON public.messages(recipient_id, created_at DESC);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,            -- like|comment|follow|connection_request|connection_accepted|message|endorsement|repost
  entity_type text,              -- post|comment|profile|message
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

-- Helper to insert notifications from triggers (security definer)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_actor_id uuid, p_kind text,
  p_entity_type text, p_entity_id uuid, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id = p_actor_id THEN RETURN NULL; END IF;
  INSERT INTO public.notifications (user_id, actor_id, kind, entity_type, entity_id, payload)
  VALUES (p_user_id, p_actor_id, p_kind, p_entity_type, p_entity_id, COALESCE(p_payload,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;$$;

-- Triggers: like / comment / follow / message / connection
CREATE OR REPLACE FUNCTION public.notify_on_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL THEN
    PERFORM public.create_notification(v_author, NEW.user_id, 'like', 'post', NEW.post_id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL THEN
    PERFORM public.create_notification(v_author, NEW.user_id, 'comment', 'post', NEW.post_id,
      jsonb_build_object('comment_id', NEW.id));
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.following_id, NEW.follower_id, 'follow', 'profile', NEW.follower_id, '{}'::jsonb);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

CREATE OR REPLACE FUNCTION public.notify_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.recipient_id, NEW.sender_id, 'message', 'message', NEW.id,
    jsonb_build_object('preview', left(NEW.body, 120)));
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

CREATE OR REPLACE FUNCTION public.notify_on_connection() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(NEW.addressee_id, NEW.requester_id, 'connection_request', 'profile', NEW.requester_id, '{}'::jsonb);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    PERFORM public.create_notification(NEW.requester_id, NEW.addressee_id, 'connection_accepted', 'profile', NEW.addressee_id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_connection_ins AFTER INSERT ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_connection();
CREATE TRIGGER trg_notify_connection_upd AFTER UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_connection();

-- =========================================================
-- SKILL ENDORSEMENTS
-- =========================================================
CREATE TABLE public.skill_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endorser_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill text NOT NULL CHECK (length(skill) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, endorser_id, skill),
  CHECK (profile_id <> endorser_id)
);
GRANT SELECT, INSERT, DELETE ON public.skill_endorsements TO authenticated;
GRANT SELECT ON public.skill_endorsements TO anon;
GRANT ALL ON public.skill_endorsements TO service_role;
ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Endorsements are public" ON public.skill_endorsements
  FOR SELECT USING (true);
CREATE POLICY "Endorse others" ON public.skill_endorsements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = endorser_id);
CREATE POLICY "Remove own endorsement" ON public.skill_endorsements
  FOR DELETE TO authenticated USING (auth.uid() = endorser_id);

CREATE OR REPLACE FUNCTION public.notify_on_endorsement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.profile_id, NEW.endorser_id, 'endorsement', 'profile', NEW.profile_id,
    jsonb_build_object('skill', NEW.skill));
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_endorsement AFTER INSERT ON public.skill_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_endorsement();

-- =========================================================
-- REPOSTS
-- =========================================================
CREATE TABLE public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.reposts TO authenticated;
GRANT SELECT ON public.reposts TO anon;
GRANT ALL ON public.reposts TO service_role;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reposts are public" ON public.reposts
  FOR SELECT USING (true);
CREATE POLICY "Create own repost" ON public.reposts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own repost" ON public.reposts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_on_repost() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NOT NULL THEN
    PERFORM public.create_notification(v_author, NEW.user_id, 'repost', 'post', NEW.post_id, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_repost AFTER INSERT ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_repost();
