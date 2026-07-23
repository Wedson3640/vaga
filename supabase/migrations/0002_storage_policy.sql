-- Libera upload (insert) de qualquer visitante no bucket "curriculos".
-- Sem esta policy, o bucket existe mas toda gravação é bloqueada por RLS
-- (storage.objects tem RLS ligado por padrão em todo projeto Supabase).
create policy "curriculos: anyone can upload"
on storage.objects for insert to anon
with check (bucket_id = 'curriculos');
