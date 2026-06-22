DROP POLICY IF EXISTS "Owners insert companies" ON public.companies;
CREATE POLICY "Employers create companies" ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_type <> 'professional'
    )
  );