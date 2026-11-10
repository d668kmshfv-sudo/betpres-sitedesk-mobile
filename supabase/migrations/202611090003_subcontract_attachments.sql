-- Private photos/PDFs for one subcontractor scope and one diary day.
-- Depends on 202611090001_subcontract_portal.sql.
begin;

do $$
begin
  if to_regclass('public.subcontract_diary_days') is null
     or to_regclass('storage.buckets') is null
     or to_regclass('storage.objects') is null then
    raise exception 'Subcontractor portal tables or Supabase Storage schema are missing';
  end if;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'subcontract-private', 'subcontract-private', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.subcontract_attachments (
  id uuid primary key,
  scope_id uuid not null references public.subcontract_scopes(id),
  diary_day_id uuid not null references public.subcontract_diary_days(id),
  path text not null unique,
  name text not null check (length(trim(name)) between 1 and 240),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index subcontract_attachments_day_idx on public.subcontract_attachments(diary_day_id, created_at);

-- The path is exactly scope UUID / day UUID / attachment UUID / safe filename.
-- No slash, parent directory, or unvalidated UUID is accepted in a segment.
create function sitedesk_private.subcontract_path_parts(p_path text)
returns text[] language sql immutable set search_path = '' as $$
  select regexp_match(p_path,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/' ||
    '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/' ||
    '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/' ||
    '([a-z0-9][a-z0-9._-]{0,179})$', 'i');
$$;

create function sitedesk_private.subcontract_storage_upload(p_path text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  v_parts text[];
  v_scope_id uuid;
  v_day date;
begin
  v_parts := sitedesk_private.subcontract_path_parts(p_path);
  if v_parts is null then return false; end if;
  v_scope_id := v_parts[1]::uuid;
  if not (sitedesk_private.subcontract_supplier(v_scope_id)
          or sitedesk_private.subcontract_main(v_scope_id)) then
    return false;
  end if;
  select d.day into v_day from public.subcontract_diary_days d
  where d.id = v_parts[2]::uuid and d.scope_id = v_scope_id;
  if not found then return false; end if;
  perform sitedesk_private.subcontract_lock_open_day(v_scope_id, v_day);
  return true;
end;
$$;

create function sitedesk_private.subcontract_storage_read(p_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_parts text[]; v_scope_id uuid;
begin
  v_parts := sitedesk_private.subcontract_path_parts(p_path);
  if v_parts is null then return false; end if;
  v_scope_id := v_parts[1]::uuid;
  return sitedesk_private.subcontract_can_read(v_scope_id)
    and exists (
      select 1 from public.subcontract_attachments a
      where a.path = p_path and a.scope_id = v_scope_id
        and a.diary_day_id = v_parts[2]::uuid and a.id = v_parts[3]::uuid
    );
end;
$$;

create function sitedesk_private.subcontract_guard_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_parts text[];
  v_day date;
  v_metadata jsonb;
begin
  if not (sitedesk_private.subcontract_supplier(new.scope_id)
          or sitedesk_private.subcontract_main(new.scope_id)) then
    raise exception 'Prílohu cudzej firmy nemožno vložiť' using errcode = '42501';
  end if;
  v_parts := sitedesk_private.subcontract_path_parts(new.path);
  if v_parts is null or v_parts[1]::uuid <> new.scope_id
      or v_parts[2]::uuid <> new.diary_day_id or v_parts[3]::uuid <> new.id
      or v_parts[4] in ('.', '..') then
    raise exception 'Neplatná cesta prílohy' using errcode = '42501';
  end if;
  select d.day into v_day from public.subcontract_diary_days d
  where d.id = new.diary_day_id and d.scope_id = new.scope_id;
  if not found then
    raise exception 'Príloha nepatrí k tomuto denníku' using errcode = '42501';
  end if;
  perform sitedesk_private.subcontract_lock_open_day(new.scope_id, v_day);
  select o.metadata into v_metadata from storage.objects o
  where o.bucket_id = 'subcontract-private'
    and o.name = new.path and o.owner_id = auth.uid()::text;
  if not found then
    raise exception 'Najprv nahraj súbor vlastným účtom do súkromného úložiska'
      using errcode = '42501';
  end if;
  if coalesce(v_metadata->>'size', '') !~ '^[0-9]+$'
     or coalesce(v_metadata->>'mimetype', '') = '' then
    raise exception 'Úložisko nevrátilo veľkosť alebo typ prílohy' using errcode = '42501';
  end if;
  -- Values shown in the portal come from Storage, not from editable JSON.
  new.size_bytes := (v_metadata->>'size')::bigint;
  new.mime_type := v_metadata->>'mimetype';
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger subcontract_attachment_guard before insert on public.subcontract_attachments
for each row execute function sitedesk_private.subcontract_guard_attachment();
create trigger subcontract_attachment_audit after insert on public.subcontract_attachments
for each row execute function sitedesk_private.subcontract_audit_write();

revoke all on public.subcontract_attachments from public, anon, authenticated;
grant select on public.subcontract_attachments to authenticated;
grant insert (id, scope_id, diary_day_id, path, name, mime_type, size_bytes)
  on public.subcontract_attachments to authenticated;
alter table public.subcontract_attachments enable row level security;
create policy subcontract_attachments_read on public.subcontract_attachments
for select to authenticated
using (sitedesk_private.subcontract_can_read(scope_id));
create policy subcontract_attachments_create on public.subcontract_attachments
for insert to authenticated
with check (created_by = (select auth.uid()) and
  (sitedesk_private.subcontract_supplier(scope_id)
    or sitedesk_private.subcontract_main(scope_id)));
-- No UPDATE or DELETE of attachment metadata. Corrections are new, audited files.

revoke all on function sitedesk_private.subcontract_path_parts(text),
  sitedesk_private.subcontract_storage_upload(text),
  sitedesk_private.subcontract_storage_read(text),
  sitedesk_private.subcontract_guard_attachment() from public, anon;
grant execute on function sitedesk_private.subcontract_path_parts(text),
  sitedesk_private.subcontract_storage_upload(text),
  sitedesk_private.subcontract_storage_read(text) to authenticated;

-- The permissive rules grant this bucket's two operations; restrictive rules
-- guard against any broad storage policy already present in the project.
create policy subcontract_private_read on storage.objects
for select to authenticated
using (bucket_id = 'subcontract-private'
  and sitedesk_private.subcontract_storage_read(name));
create policy subcontract_private_read_guard on storage.objects as restrictive
for select to authenticated
using (bucket_id <> 'subcontract-private'
  or (auth.uid() is not null and sitedesk_private.subcontract_storage_read(name)));
create policy subcontract_private_anon_read_guard on storage.objects as restrictive
for select to anon
using (bucket_id <> 'subcontract-private');

create policy subcontract_private_upload on storage.objects
for insert to authenticated
with check (bucket_id = 'subcontract-private'
  and sitedesk_private.subcontract_storage_upload(name));
create policy subcontract_private_upload_guard on storage.objects as restrictive
for insert to authenticated
with check (bucket_id <> 'subcontract-private'
  or (auth.uid() is not null and sitedesk_private.subcontract_storage_upload(name)));
create policy subcontract_private_anon_upload_guard on storage.objects as restrictive
for insert to anon
with check (bucket_id <> 'subcontract-private');

create policy subcontract_private_no_replace on storage.objects as restrictive
for update to public
using (bucket_id <> 'subcontract-private')
with check (bucket_id <> 'subcontract-private');
create policy subcontract_private_no_delete on storage.objects as restrictive
for delete to public
using (bucket_id <> 'subcontract-private');
commit;
