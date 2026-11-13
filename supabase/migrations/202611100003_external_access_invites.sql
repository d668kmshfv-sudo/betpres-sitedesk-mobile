-- Keep external accounts out of the full BETPRES workspace, even if a later
-- team invite or direct owner transfer is attempted. Accept invitations only
-- after the invited person has confirmed the same e-mail in Supabase Auth.
begin;

create function sitedesk_private.external_account_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
  v_full_member boolean;
begin
  if tg_table_name = 'sitedesk_workspace_members' then
    if new.status <> 'active' then return new; end if;
    v_workspace_id := new.workspace_id;
    v_user_id := new.user_id;
    v_full_member := true;
  elsif tg_table_name = 'sitedesk_workspaces' then
    v_workspace_id := new.id;
    v_user_id := new.owner_id;
    v_full_member := true;
  elsif tg_table_name = 'sitedesk_module_people' then
    v_workspace_id := new.workspace_id;
    v_user_id := new.user_id;
    v_full_member := true;
  elsif tg_table_name = 'subcontract_scope_members' then
    select s.workspace_id into v_workspace_id
    from public.subcontract_scopes s where s.id = new.scope_id;
    v_user_id := new.user_id;
    v_full_member := false;
  elsif tg_table_name = 'diary_review_members' then
    select s.workspace_id into v_workspace_id
    from public.diary_review_scopes s where s.id = new.scope_id;
    v_user_id := new.user_id;
    v_full_member := false;
  else
    raise exception 'Unsupported access table';
  end if;

  if v_workspace_id is null or v_user_id is null then
    raise exception 'Workspace and user are required';
  end if;
  -- Serialize opposite-direction grants on the same workspace. A trigger on
  -- only one table would still allow a concurrent full-team invite to win.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_workspace_id::text, 570003)
  );

  if v_full_member then
    if exists (
      select 1 from public.subcontract_scope_members m
      join public.subcontract_scopes s on s.id = m.scope_id
      where s.workspace_id = v_workspace_id and m.user_id = v_user_id
    ) or exists (
      select 1 from public.diary_review_members m
      join public.diary_review_scopes s on s.id = m.scope_id
      where s.workspace_id = v_workspace_id and m.user_id = v_user_id
    ) then
      raise exception 'Externý účet nemožno pridať do celého tímu tejto stavby'
        using errcode = '42501';
    end if;
  else
    if exists (
      select 1 from public.sitedesk_workspaces w
      where w.id = v_workspace_id and w.owner_id = v_user_id
    ) or exists (
      select 1 from public.sitedesk_workspace_members m
      where m.workspace_id = v_workspace_id and m.user_id = v_user_id
        and m.status = 'active'
    ) or exists (
      select 1 from public.sitedesk_module_people p
      where p.workspace_id = v_workspace_id and p.user_id = v_user_id
    ) then
      raise exception 'Člen hlavného tímu potrebuje samostatný externý účet'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger sitedesk_external_guard_full_member
before insert or update of workspace_id, user_id, status
on public.sitedesk_workspace_members
for each row execute function sitedesk_private.external_account_guard();

create trigger sitedesk_external_guard_owner
before insert or update of owner_id
on public.sitedesk_workspaces
for each row execute function sitedesk_private.external_account_guard();

create trigger sitedesk_external_guard_module_person
before insert or update of workspace_id, user_id
on public.sitedesk_module_people
for each row execute function sitedesk_private.external_account_guard();

create trigger sitedesk_external_guard_supplier
before insert or update of scope_id, user_id
on public.subcontract_scope_members
for each row execute function sitedesk_private.external_account_guard();

create trigger sitedesk_external_guard_reviewer
before insert or update of scope_id, user_id
on public.diary_review_members
for each row execute function sitedesk_private.external_account_guard();

create table public.subcontract_invitations (
  scope_id uuid not null references public.subcontract_scopes(id),
  email text not null check (
    email = lower(trim(email)) and
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'revoked')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  revoked_at timestamptz,
  primary key (scope_id, email)
);
create index subcontract_invitations_email_idx
on public.subcontract_invitations(email, status);

revoke all on public.subcontract_invitations from public, anon, authenticated;
grant select on public.subcontract_invitations to authenticated;
alter table public.subcontract_invitations enable row level security;
create policy subcontract_invitations_owner_read
on public.subcontract_invitations for select to authenticated
using (sitedesk_private.subcontract_owner(scope_id));

create function public.subcontract_invite(p_scope_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_workspace_id uuid;
  v_user_id uuid;
begin
  if not sitedesk_private.subcontract_owner(p_scope_id) then
    raise exception 'Pozývať môže iba vlastník pracovného priestoru'
      using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Zadaj platný e-mail subdodávateľa';
  end if;
  select s.workspace_id into v_workspace_id
  from public.subcontract_scopes s where s.id = p_scope_id;
  select u.id into v_user_id from auth.users u where lower(u.email) = v_email;
  if v_user_id is not null and (
    exists (select 1 from public.sitedesk_workspaces w
            where w.id = v_workspace_id and w.owner_id = v_user_id)
    or exists (select 1 from public.sitedesk_workspace_members m
               where m.workspace_id = v_workspace_id and m.user_id = v_user_id
                 and m.status = 'active')
    or exists (select 1 from public.sitedesk_module_people p
               where p.workspace_id = v_workspace_id and p.user_id = v_user_id)
  ) then
    raise exception 'Tento e-mail patrí členovi celého tímu. Použi samostatný účet.'
      using errcode = '42501';
  end if;
  insert into public.subcontract_invitations
    (scope_id, email, status, created_by)
  values (p_scope_id, v_email, 'pending', auth.uid())
  on conflict (scope_id, email) do update
    set status = 'pending', created_by = auth.uid(), created_at = now(),
        claimed_by = null, claimed_at = null, revoked_at = null;
end;
$$;

create function public.subcontract_claim_invite(p_scope_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then return false; end if;
  select lower(u.email) into v_email from auth.users u
  where u.id = v_user_id and u.email_confirmed_at is not null;
  if v_email is null then return false; end if;
  perform 1 from public.subcontract_invitations i
  where i.scope_id = p_scope_id and i.email = v_email and i.status = 'pending'
  for update;
  if not found then return false; end if;

  insert into public.subcontract_scope_members
    (scope_id, user_id, email, role, created_by)
  select i.scope_id, v_user_id, v_email, 'supplier_writer', i.created_by
  from public.subcontract_invitations i
  where i.scope_id = p_scope_id and i.email = v_email and i.status = 'pending'
  on conflict (scope_id, user_id) do update
    set email = excluded.email, role = excluded.role;

  update public.subcontract_invitations
  set status = 'claimed', claimed_by = v_user_id, claimed_at = now()
  where scope_id = p_scope_id and email = v_email and status = 'pending';
  return true;
end;
$$;

create function public.subcontract_revoke_invite(p_scope_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not sitedesk_private.subcontract_owner(p_scope_id) then
    raise exception 'Pozvanie môže zrušiť iba vlastník pracovného priestoru'
      using errcode = '42501';
  end if;
  update public.subcontract_invitations
  set status = 'revoked', revoked_at = now()
  where scope_id = p_scope_id and email = lower(trim(p_email))
    and status = 'pending';
end;
$$;

revoke all on function sitedesk_private.external_account_guard(),
  public.subcontract_invite(uuid, text),
  public.subcontract_claim_invite(uuid),
  public.subcontract_revoke_invite(uuid, text)
from public, anon, authenticated;
grant execute on function public.subcontract_invite(uuid, text),
  public.subcontract_claim_invite(uuid),
  public.subcontract_revoke_invite(uuid, text)
to authenticated;

commit;
