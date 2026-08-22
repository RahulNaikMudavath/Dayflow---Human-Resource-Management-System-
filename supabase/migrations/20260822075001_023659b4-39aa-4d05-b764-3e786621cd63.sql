CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar, admins upload for anyone"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Users can replace their own avatar, admins for anyone"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "Users can remove their own avatar, admins for anyone"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  )
);