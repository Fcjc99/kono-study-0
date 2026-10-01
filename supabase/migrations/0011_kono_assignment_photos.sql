-- Photos on assignments and exams (src/store/photoStore.ts). The plan keeps only photo ids; the
-- pictures go in a private Storage bucket, one folder per account (<user id>/<photo id>.jpg), which
-- only that account can read or write. JPEG/PNG/WebP up to 3 MB (KONO shrinks them to ~200 KB first).
-- Wrapped so it is skipped on a database without Supabase Storage (the local policy tests).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'No storage schema: skipping the kono-photos bucket.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('kono-photos', 'kono-photos', false, 3145728, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists "Students read their own photos" on storage.objects;
  drop policy if exists "Students add their own photos" on storage.objects;
  drop policy if exists "Students replace their own photos" on storage.objects;
  drop policy if exists "Students delete their own photos" on storage.objects;

  create policy "Students read their own photos" on storage.objects for select to authenticated
    using (bucket_id = 'kono-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "Students add their own photos" on storage.objects for insert to authenticated
    with check (bucket_id = 'kono-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "Students replace their own photos" on storage.objects for update to authenticated
    using (bucket_id = 'kono-photos' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'kono-photos' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "Students delete their own photos" on storage.objects for delete to authenticated
    using (bucket_id = 'kono-photos' and (storage.foldername(name))[1] = auth.uid()::text);
end $$;
