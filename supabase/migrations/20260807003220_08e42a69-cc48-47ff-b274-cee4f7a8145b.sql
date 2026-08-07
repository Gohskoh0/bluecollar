ALTER TABLE public.connections DROP CONSTRAINT connections_requester_id_fkey;
ALTER TABLE public.connections DROP CONSTRAINT connections_addressee_id_fkey;
ALTER TABLE public.connections
  ADD CONSTRAINT connections_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT connections_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.messages DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT messages_recipient_id_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_actor_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;