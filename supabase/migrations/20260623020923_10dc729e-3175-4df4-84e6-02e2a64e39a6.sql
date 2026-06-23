
-- Trigger-only functions: revoke direct EXECUTE; they still fire via triggers as the owner.
REVOKE EXECUTE ON FUNCTION public.handle_reward_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_post_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_follow_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_like_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_comment_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_growth_contribution() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_like_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_application_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_application_count() FROM PUBLIC, anon, authenticated;
