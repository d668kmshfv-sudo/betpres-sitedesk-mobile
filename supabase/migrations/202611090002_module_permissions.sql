-- Individual, per-project module access for internal BETPRES colleagues.
-- This is an isolated data plane. A module-only account must never be added
-- to the legacy workspace member list, which exposes the entire JSON state.
-- Apply only after checking the existing RPC signatures in the target DB.

begin;

do $$
begin
  if to_regclass('public.sitedesk_workspaces') is null
     or not exists (
       select 1 from pg_catalog.pg_attribute a
       where a.attrelid = to_regclass('public.sitedesk_workspaces')
         and a.attname = 'id' and a.atttypid = 'uuid'::regtype
         and not a.attisdropped
     ) then
    raise exception 'Required public.sitedesk_workspaces(id uuid) is missing';
  end if;
  if to_regprocedure('public.sitedesk_current_role(uuid)') is null then
    raise exception 'Required RPC public.sitedesk_current_role(uuid) is missing';
  end if;
  if to_regprocedure('public.sitedesk_list_members(uuid)') is null then
    raise exception 'Required RPC public.sitedesk_list_members(uuid) is missing';
  end if;
end $$;

create schema if not exists sitedesk_private;
revoke all on schema sitedesk_private from public, anon;
grant usage on schema sitedesk_private to authenticated;

create table public.sitedesk_module_people (
  workspace_id uuid not null references public.sitedesk_workspaces(id),
  project_id text not null check (length(trim(project_id)) between 1 and 120),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  job_title text not null default '' check (length(job_title) <= 120),
  granted_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, project_id, user_id)
);
create index sitedesk_module_people_user_idx
  on public.sitedesk_module_people(user_id, workspace_id, project_id);

create table public.sitedesk_module_grants (
  workspace_id uuid not null,
  project_id text not null,
  user_id uuid not null,
  module_key text not null check (module_key in (
    'workers', 'site_diary', 'coordination', 'control_days',
    'material_samples', 'work_statements', 'billing', 'defects',
    'calendar', 'documents', 'handover', 'acceptance', 'companies'
  )),
  can_view boolean not null default false,
  can_edit boolean not null default false,
  granted_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, project_id, user_id, module_key),
  foreign key (workspace_id, project_id, user_id)
    references public.sitedesk_module_people(workspace_id, project_id, user_id)
    on delete cascade,
  check (can_view or not can_edit),
  check (can_view or can_edit)
);
create index sitedesk_module_grants_user_idx
  on public.sitedesk_module_grants(user_id, workspace_id, project_id, module_key);

-- Reserved read-only module data plane. There is deliberately no client write
-- grant until module-specific validation, version checks and audit are built.
-- The legacy JSON state is never returned by these policies.
create table public.sitedesk_module_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.sitedesk_workspaces(id),
  project_id text not null check (length(trim(project_id)) between 1 and 120),
  module_key text not null check (module_key in (
    'workers', 'site_diary', 'coordination', 'control_days',
    'material_samples', 'work_statements', 'billing', 'defects',
    'calendar', 'documents', 'handover', 'acceptance', 'companies'
  )),
  record_key text not null check (length(trim(record_key)) between 1 and 160),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576
  ),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id, module_key, record_key)
);
create index sitedesk_module_records_scope_idx
  on public.sitedesk_module_records(workspace_id, project_id, module_key, updated_at desc);

create function sitedesk_private.module_is_owner(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and coalesce(public.sitedesk_current_role(p_workspace_id)::text = 'owner', false);
$$;

create function sitedesk_private.module_can_view(
  p_workspace_id uuid, p_project_id text, p_module_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select sitedesk_private.module_is_owner(p_workspace_id)
      or exists (
        select 1 from public.sitedesk_module_grants g
        where g.workspace_id = p_workspace_id
          and g.project_id = p_project_id
          and g.module_key = p_module_key
          and g.user_id = auth.uid()
          and g.can_view
      );
$$;

create function sitedesk_private.module_can_edit(
  p_workspace_id uuid, p_project_id text, p_module_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select sitedesk_private.module_is_owner(p_workspace_id)
      or exists (
        select 1 from public.sitedesk_module_grants g
        where g.workspace_id = p_workspace_id
          and g.project_id = p_project_id
          and g.module_key = p_module_key
          and g.user_id = auth.uid()
          and g.can_edit
      );
$$;

alter table public.sitedesk_module_people enable row level security;
alter table public.sitedesk_module_grants enable row level security;
alter table public.sitedesk_module_records enable row level security;

create policy sitedesk_module_people_read on public.sitedesk_module_people
for select to authenticated
using (user_id = auth.uid() or sitedesk_private.module_is_owner(workspace_id));

create policy sitedesk_module_grants_read on public.sitedesk_module_grants
for select to authenticated
using (user_id = auth.uid() or sitedesk_private.module_is_owner(workspace_id));

create policy sitedesk_module_records_read on public.sitedesk_module_records
for select to authenticated
using (sitedesk_private.module_can_view(workspace_id, project_id, module_key));

revoke all on public.sitedesk_module_people,
  public.sitedesk_module_grants, public.sitedesk_module_records
  from public, anon, authenticated;
grant select on public.sitedesk_module_people,
  public.sitedesk_module_grants, public.sitedesk_module_records
  to authenticated;

revoke all on function sitedesk_private.module_is_owner(uuid),
  sitedesk_private.module_can_view(uuid,text,text),
  sitedesk_private.module_can_edit(uuid,text,text)
  from public, anon;
grant execute on function sitedesk_private.module_is_owner(uuid),
  sitedesk_private.module_can_view(uuid,text,text),
  sitedesk_private.module_can_edit(uuid,text,text)
  to authenticated;

-- Save the exact grant set atomically. Job title is descriptive only.
-- Existing full-workspace members are rejected to prevent a misleading
-- impression that their access has been narrowed by these checkboxes.
create function public.sitedesk_set_module_grants(
  p_workspace_id uuid, p_project_id text, p_email text,
  p_job_title text, p_grants jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid;
  v_email text := lower(trim(p_email));
  v_title text := coalesce(trim(p_job_title), '');
  v_members jsonb;
  v_normalized jsonb;
  v_full_member boolean;
  v_module text;
  v_permission jsonb;
  v_view boolean;
  v_edit boolean;
begin
  if not sitedesk_private.module_is_owner(p_workspace_id) then
    raise exception 'Oprávnenia môže nastaviť iba vlastník pracovného priestoru'
      using errcode = '42501';
  end if;
  if p_project_id is null or length(trim(p_project_id)) not between 1 and 120 then
    raise exception 'Vyber stavbu';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Zadaj platný e-mail';
  end if;
  if length(v_title) > 120 then raise exception 'Pracovná pozícia je príliš dlhá'; end if;
  if p_grants is null or jsonb_typeof(p_grants) <> 'object' then
    raise exception 'Oprávnenia musia byť objekt';
  end if;

  select u.id into v_user_id from auth.users u
  where lower(u.email) = v_email and u.email_confirmed_at is not null;
  if v_user_id is null then
    raise exception 'Kolega si musí najprv vytvoriť a potvrdiť vlastný účet';
  end if;

  -- Fail closed if the full member list cannot be read. Its production shape
  -- must be inspected in the two-account deployment test.
  execute 'select coalesce(jsonb_agg(to_jsonb(m)), ''[]''::jsonb)
           from public.sitedesk_list_members($1) as m'
    into v_members using p_workspace_id;
  select coalesce(jsonb_agg(normalized.member), '[]'::jsonb)
    into v_normalized
  from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) as raw(entry)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(raw.entry->'m') = 'array' then raw.entry->'m'
         else jsonb_build_array(coalesce(raw.entry->'m', raw.entry)) end
  ) as normalized(member);
  if v_normalized = '[]'::jsonb
     or exists (
       select 1 from jsonb_array_elements(v_normalized) as entry(member)
       where jsonb_typeof(entry.member) <> 'object'
          or nullif(entry.member->>'user_id', '') is null
          or nullif(entry.member->>'email', '') is null
     )
     or not exists (
       select 1 from jsonb_array_elements(v_normalized) as entry(member)
       where entry.member->>'user_id' = auth.uid()::text
     ) then
    raise exception 'Zoznam plných členov má neznámy formát; prístup nebol udelený'
      using errcode = '42501';
  end if;
  select exists (
    select 1
    from jsonb_array_elements(v_normalized) as normalized(member)
    where normalized.member->>'user_id' = v_user_id::text
       or lower(normalized.member->>'email') = v_email
  ) into v_full_member;
  if v_full_member then
    raise exception 'Tento účet už má prístup k celému pracovnému priestoru. Najprv mu odober starý prístup.'
      using errcode = '42501';
  end if;

  for v_module, v_permission in select key, value from jsonb_each(p_grants) loop
    if v_module not in (
      'workers', 'site_diary', 'coordination', 'control_days',
      'material_samples', 'work_statements', 'billing', 'defects',
      'calendar', 'documents', 'handover', 'acceptance', 'companies'
    ) then raise exception 'Neznámy modul: %', v_module; end if;
    if jsonb_typeof(v_permission) is distinct from 'object'
       or jsonb_typeof(v_permission->'view') is distinct from 'boolean'
       or jsonb_typeof(v_permission->'edit') is distinct from 'boolean' then
      raise exception 'Neplatné oprávnenie pre modul %', v_module;
    end if;
    v_view := (v_permission->>'view')::boolean;
    v_edit := (v_permission->>'edit')::boolean;
    if v_edit and not v_view then
      raise exception 'Úprava modulu % vyžaduje aj zobrazenie', v_module;
    end if;
  end loop;

  insert into public.sitedesk_module_people
    (workspace_id, project_id, user_id, email, job_title, granted_by)
  values (p_workspace_id, trim(p_project_id), v_user_id, v_email, v_title, auth.uid())
  on conflict (workspace_id, project_id, user_id) do update set
    email = excluded.email, job_title = excluded.job_title,
    granted_by = excluded.granted_by, updated_at = now();

  delete from public.sitedesk_module_grants g
  where g.workspace_id = p_workspace_id
    and g.project_id = trim(p_project_id) and g.user_id = v_user_id;
  insert into public.sitedesk_module_grants
    (workspace_id, project_id, user_id, module_key, can_view, can_edit, granted_by)
  select p_workspace_id, trim(p_project_id), v_user_id, e.key,
         (e.value->>'view')::boolean, (e.value->>'edit')::boolean, auth.uid()
  from jsonb_each(p_grants) e
  where (e.value->>'view')::boolean;
  return v_user_id;
end $$;

create function public.sitedesk_list_module_people(
  p_workspace_id uuid, p_project_id text)
returns table (user_id uuid, email text, job_title text, grants jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not sitedesk_private.module_is_owner(p_workspace_id) then
    raise exception 'Zoznam oprávnení môže vidieť iba vlastník'
      using errcode = '42501';
  end if;
  return query
  select p.user_id, p.email, p.job_title,
    coalesce((select jsonb_object_agg(g.module_key,
       jsonb_build_object('view', g.can_view, 'edit', g.can_edit))
       from public.sitedesk_module_grants g
       where g.workspace_id = p.workspace_id and g.project_id = p.project_id
         and g.user_id = p.user_id), '{}'::jsonb)
  from public.sitedesk_module_people p
  where p.workspace_id = p_workspace_id and p.project_id = p_project_id
  order by p.email;
end $$;

create function public.sitedesk_remove_module_person(
  p_workspace_id uuid, p_project_id text, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not sitedesk_private.module_is_owner(p_workspace_id) then
    raise exception 'Oprávnenia môže odobrať iba vlastník pracovného priestoru'
      using errcode = '42501';
  end if;
  delete from public.sitedesk_module_people p
  where p.workspace_id = p_workspace_id
    and p.project_id = p_project_id and p.user_id = p_user_id;
end $$;

revoke all on function public.sitedesk_set_module_grants(uuid,text,text,text,jsonb),
  public.sitedesk_list_module_people(uuid,text),
  public.sitedesk_remove_module_person(uuid,text,uuid) from public, anon;
grant execute on function public.sitedesk_set_module_grants(uuid,text,text,text,jsonb),
  public.sitedesk_list_module_people(uuid,text),
  public.sitedesk_remove_module_person(uuid,text,uuid) to authenticated;

commit;
