-- BETPRES subcontractor portal. Apply only after validating the existing
-- sitedesk_current_role/sitedesk_list_members RPC signatures in production.
-- No supplier account may be granted access to sitedesk_workspaces.
begin;

do $$
begin
  if to_regclass('public.sitedesk_workspaces') is null
     or to_regclass('auth.users') is null then
    raise exception 'Existing workspace or Auth schema is missing';
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

create table public.subcontract_scopes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.sitedesk_workspaces(id),
  project_id text not null,
  company_id text not null,
  project_name text not null,
  company_name text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  diary_closed_at timestamptz,
  diary_closed_by uuid references auth.users(id),
  constraint subcontract_scope_unique unique (workspace_id, project_id, company_id),
  constraint subcontract_scope_names check (length(trim(project_name)) > 0 and length(trim(company_name)) > 0)
);

create table public.subcontract_scope_members (
  scope_id uuid not null references public.subcontract_scopes(id),
  user_id uuid not null references auth.users(id),
  email text not null,
  role text not null default 'supplier_writer' check (role in ('supplier_writer', 'supplier_viewer')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (scope_id, user_id)
);
create index subcontract_member_user_idx on public.subcontract_scope_members(user_id, scope_id);

create table public.subcontract_diary_days (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.subcontract_scopes(id),
  day date not null,
  works text not null default '',
  machinery text not null default '',
  status text not null default 'draft' check (status in ('draft', 'closed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  constraint subcontract_diary_day_unique unique (scope_id, day),
  constraint subcontract_diary_closed_consistent check ((status = 'closed') = (closed_at is not null))
);
create index subcontract_diary_scope_date_idx on public.subcontract_diary_days(scope_id, day desc);

create table public.subcontract_daily_crew (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.subcontract_scopes(id),
  day date not null,
  worker_count integer not null default 0 check (worker_count >= 0),
  professions jsonb not null default '[]'::jsonb check (jsonb_typeof(professions) = 'array'),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcontract_crew_day_unique unique (scope_id, day)
);
create index subcontract_crew_scope_date_idx on public.subcontract_daily_crew(scope_id, day desc);

create table public.subcontract_work_items (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.subcontract_scopes(id),
  source_item_id text not null,
  code text not null default '',
  description text not null,
  unit text not null default '',
  contract_qty numeric(18,3) not null default 0,
  unit_price numeric(18,4) not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcontract_work_item_unique unique (scope_id, source_item_id),
  constraint subcontract_work_item_name check (length(trim(description)) > 0),
  constraint subcontract_contract_qty_nonnegative check (contract_qty >= 0)
);
create index subcontract_work_items_scope_idx on public.subcontract_work_items(scope_id, sort_order, id);

create table public.subcontract_statements (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.subcontract_scopes(id),
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'closed')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id),
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  constraint subcontract_statement_unique unique (scope_id, period),
  constraint subcontract_statement_closed_consistent check ((status = 'closed') = (closed_at is not null))
);
create index subcontract_statement_scope_period_idx on public.subcontract_statements(scope_id, period desc);

create table public.subcontract_statement_rows (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.subcontract_statements(id),
  work_item_id uuid not null references public.subcontract_work_items(id),
  quantity numeric(18,3) not null default 0 check (quantity >= 0),
  unit_price_snapshot numeric(18,4) not null default 0,
  contract_qty_snapshot numeric(18,3) not null default 0,
  line_total numeric(22,2) generated always as (round(quantity * unit_price_snapshot, 2)) stored,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subcontract_statement_work_item_unique unique (statement_id, work_item_id)
);
create index subcontract_statement_rows_statement_idx on public.subcontract_statement_rows(statement_id);

create table public.subcontract_owner_notes (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.subcontract_scopes(id),
  day date not null,
  body text not null check (length(trim(body)) > 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index subcontract_owner_notes_scope_day_idx on public.subcontract_owner_notes(scope_id, day desc);

create table public.subcontract_audit (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.subcontract_scopes(id),
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid default auth.uid() references auth.users(id),
  changed_at timestamptz not null default now()
);
create index subcontract_audit_scope_time_idx on public.subcontract_audit(scope_id, changed_at desc);

-- All membership lookups run outside table RLS to avoid policy recursion.
-- These functions are in a schema that is not exposed through PostgREST.
create function sitedesk_private.subcontract_main_workspace(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and public.sitedesk_current_role(p_workspace_id)::text in ('owner', 'editor');
$$;

create function sitedesk_private.subcontract_owner_workspace(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
    and public.sitedesk_current_role(p_workspace_id)::text = 'owner';
$$;

create function sitedesk_private.subcontract_main(p_scope_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subcontract_scopes s
    where s.id = p_scope_id
      and sitedesk_private.subcontract_main_workspace(s.workspace_id)
  );
$$;

create function sitedesk_private.subcontract_owner(p_scope_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subcontract_scopes s
    where s.id = p_scope_id
      and sitedesk_private.subcontract_owner_workspace(s.workspace_id)
  );
$$;

create function sitedesk_private.subcontract_supplier(p_scope_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.subcontract_scope_members m
    where m.scope_id = p_scope_id and m.user_id = (select auth.uid())
      and m.role = 'supplier_writer'
  );
$$;

create function sitedesk_private.subcontract_can_read(p_scope_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select sitedesk_private.subcontract_main(p_scope_id)
    or ((select auth.uid()) is not null and exists (
      select 1 from public.subcontract_scope_members m
      where m.scope_id = p_scope_id and m.user_id = (select auth.uid())
    ));
$$;

create function sitedesk_private.subcontract_statement_scope(p_statement_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.scope_id from public.subcontract_statements s where s.id = p_statement_id;
$$;

create function sitedesk_private.subcontract_statement_writable(p_statement_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subcontract_statements s
    where s.id = p_statement_id and s.status <> 'closed'
      and (sitedesk_private.subcontract_main(s.scope_id)
        or (s.status = 'draft' and sitedesk_private.subcontract_supplier(s.scope_id)))
  );
$$;

create function sitedesk_private.subcontract_lock_open_day(p_scope_id uuid, p_day date)
returns void language plpgsql security definer set search_path = '' as $$
declare v_closed_at timestamptz;
begin
  -- FOR SHARE serializes a supplier write with the owner's closure transaction.
  select s.diary_closed_at into v_closed_at
  from public.subcontract_scopes s where s.id = p_scope_id for share;
  if not found or v_closed_at is not null then
    raise exception 'Stavebný denník je uzatvorený' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.subcontract_diary_days d
    where d.scope_id = p_scope_id and d.day = p_day and d.status = 'closed'
  ) then
    raise exception 'Záznam tohto dňa je uzatvorený' using errcode = 'P0001';
  end if;
end;
$$;

create function sitedesk_private.subcontract_guard_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not sitedesk_private.subcontract_main_workspace(new.workspace_id) then
      raise exception 'Prístup k pracovnému priestoru bol zamietnutý' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.diary_closed_at := null;
    new.diary_closed_by := null;
    return new;
  end if;
  if not sitedesk_private.subcontract_main(old.id) then
    raise exception 'Len hlavný zhotoviteľ môže upraviť priradenie' using errcode = '42501';
  end if;
  if (new.id, new.workspace_id, new.project_id, new.company_id, new.created_by, new.created_at)
      is distinct from
     (old.id, old.workspace_id, old.project_id, old.company_id, old.created_by, old.created_at) then
    raise exception 'Identita stavby a firmy je nemenná' using errcode = '42501';
  end if;
  if old.diary_closed_at is not null then
    raise exception 'Uzatvorený denník je nemenný' using errcode = '42501';
  end if;
  if new.diary_closed_at is distinct from old.diary_closed_at then
    if new.diary_closed_at is null then
      raise exception 'Denník sa nedá spätne otvoriť' using errcode = '42501';
    end if;
    new.diary_closed_at := pg_catalog.now();
    new.diary_closed_by := auth.uid();
  elsif new.diary_closed_by is distinct from old.diary_closed_by then
    raise exception 'Uzávierku môže nastaviť iba server' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function sitedesk_private.subcontract_guard_diary_day()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (sitedesk_private.subcontract_supplier(new.scope_id)
          or sitedesk_private.subcontract_main(new.scope_id)) then
    raise exception 'Zápis do cudzieho denníka je zakázaný' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if (new.id, new.scope_id, new.day, new.created_by, new.created_at)
        is distinct from
       (old.id, old.scope_id, old.day, old.created_by, old.created_at) then
      raise exception 'Dátum alebo firma denníka sa nedá zmeniť' using errcode = '42501';
    end if;
    if old.status = 'closed' then
      raise exception 'Uzatvorený denný zápis je nemenný' using errcode = '42501';
    end if;
  end if;
  perform sitedesk_private.subcontract_lock_open_day(new.scope_id, new.day);
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Nový denný zápis musí byť rozpracovaný' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.closed_at := null;
    new.closed_by := null;
  elsif new.status is distinct from old.status then
    if new.status <> 'closed' or not sitedesk_private.subcontract_main(new.scope_id) then
      raise exception 'Denný zápis môže uzatvoriť iba hlavný zhotoviteľ' using errcode = '42501';
    end if;
    new.closed_at := pg_catalog.now();
    new.closed_by := auth.uid();
  elsif (new.closed_at, new.closed_by) is distinct from (old.closed_at, old.closed_by) then
    raise exception 'Uzávierku môže nastaviť iba server' using errcode = '42501';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function sitedesk_private.subcontract_guard_crew()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (sitedesk_private.subcontract_supplier(new.scope_id)
          or sitedesk_private.subcontract_main(new.scope_id)) then
    raise exception 'Stav pracovníkov cudzej firmy je nedostupný' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and
     (new.id, new.scope_id, new.day, new.created_by, new.created_at)
       is distinct from
     (old.id, old.scope_id, old.day, old.created_by, old.created_at) then
    raise exception 'Dátum alebo firma pracovníkov sa nedá zmeniť' using errcode = '42501';
  end if;
  perform sitedesk_private.subcontract_lock_open_day(new.scope_id, new.day);
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function sitedesk_private.subcontract_guard_work_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not sitedesk_private.subcontract_main(new.scope_id) then
    raise exception 'Rozpočet môže publikovať iba hlavný zhotoviteľ' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and
     (new.id, new.scope_id, new.source_item_id, new.created_by, new.created_at)
       is distinct from
     (old.id, old.scope_id, old.source_item_id, old.created_by, old.created_at) then
    raise exception 'Identita položky súpisu je nemenná' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function sitedesk_private.subcontract_guard_statement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (sitedesk_private.subcontract_supplier(new.scope_id)
          or sitedesk_private.subcontract_main(new.scope_id)) then
    raise exception 'Súpis cudzej firmy je nedostupný' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Nový súpis musí byť rozpracovaný' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.submitted_at := null;
    new.submitted_by := null;
    new.closed_at := null;
    new.closed_by := null;
  else
    if (new.id, new.scope_id, new.period, new.created_by, new.created_at)
        is distinct from
       (old.id, old.scope_id, old.period, old.created_by, old.created_at) then
      raise exception 'Firma ani obdobie súpisu sa nedá zmeniť' using errcode = '42501';
    end if;
    if old.status = 'closed' then
      raise exception 'Uzatvorený súpis je nemenný' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      if old.status = 'draft' and new.status = 'submitted'
         and sitedesk_private.subcontract_supplier(new.scope_id) then
        new.submitted_at := pg_catalog.now();
        new.submitted_by := auth.uid();
      elsif new.status = 'closed' and sitedesk_private.subcontract_main(new.scope_id) then
        new.closed_at := pg_catalog.now();
        new.closed_by := auth.uid();
      else
        raise exception 'Neplatný prechod stavu súpisu' using errcode = '42501';
      end if;
    elsif (new.submitted_at, new.submitted_by, new.closed_at, new.closed_by)
          is distinct from
          (old.submitted_at, old.submitted_by, old.closed_at, old.closed_by) then
      raise exception 'Stav súpisu môže nastaviť iba server' using errcode = '42501';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function sitedesk_private.subcontract_guard_statement_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_scope_id uuid;
  v_status text;
  v_item public.subcontract_work_items%rowtype;
begin
  -- A row write and a status change lock the same statement row.
  select s.scope_id, s.status into v_scope_id, v_status
  from public.subcontract_statements s where s.id = new.statement_id for share;
  if not found then raise exception 'Mesačný súpis neexistuje'; end if;
  if v_status = 'closed' or not (
    sitedesk_private.subcontract_main(v_scope_id) or
    (v_status = 'draft' and sitedesk_private.subcontract_supplier(v_scope_id))
  ) then
    raise exception 'Tento mesačný súpis sa už nedá upraviť' using errcode = '42501';
  end if;
  -- Serialize the price snapshot with an owner's concurrent budget update.
  select * into v_item from public.subcontract_work_items i
  where i.id = new.work_item_id for share;
  if not found or v_item.scope_id <> v_scope_id then
    raise exception 'Položka nepatrí k firme a stavbe súpisu' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if not v_item.is_active and not exists (
      select 1 from public.subcontract_statement_rows r
      where r.statement_id = new.statement_id and r.work_item_id = new.work_item_id
    ) then
      raise exception 'Neaktívnu položku nemožno pridať do nového súpisu' using errcode = '42501';
    end if;
    new.created_by := auth.uid();
    new.unit_price_snapshot := v_item.unit_price;
    new.contract_qty_snapshot := v_item.contract_qty;
  else
    if (new.id, new.statement_id, new.work_item_id, new.created_by, new.created_at,
        new.unit_price_snapshot, new.contract_qty_snapshot)
        is distinct from
       (old.id, old.statement_id, old.work_item_id, old.created_by, old.created_at,
        old.unit_price_snapshot, old.contract_qty_snapshot) then
      raise exception 'Jednotkovú cenu ani identitu riadku nemožno zmeniť' using errcode = '42501';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function sitedesk_private.subcontract_guard_note()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not sitedesk_private.subcontract_main(new.scope_id) then
    raise exception 'Záznam hlavného zhotoviteľa môže vložiť iba hlavný zhotoviteľ'
      using errcode = '42501';
  end if;
  perform sitedesk_private.subcontract_lock_open_day(new.scope_id, new.day);
  new.created_by := auth.uid();
  return new;
end;
$$;

create function sitedesk_private.subcontract_audit_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_scope_id uuid; v_row_id uuid;
begin
  if tg_op = 'DELETE' then
    insert into public.subcontract_audit(scope_id, table_name, row_id, action, old_data, new_data, changed_by)
    values (old.scope_id, tg_table_name, old.user_id, tg_op, to_jsonb(old), null, auth.uid());
    return old;
  end if;
  if tg_table_name = 'subcontract_scopes' then
    v_scope_id := new.id;
  elsif tg_table_name = 'subcontract_scope_members' then
    v_scope_id := new.scope_id;
    v_row_id := new.user_id;
  elsif tg_table_name = 'subcontract_statement_rows' then
    select s.scope_id into v_scope_id from public.subcontract_statements s where s.id = new.statement_id;
  else
    v_scope_id := new.scope_id;
  end if;
  if v_row_id is null then v_row_id := new.id; end if;
  insert into public.subcontract_audit(scope_id, table_name, row_id, action, old_data, new_data, changed_by)
  values (v_scope_id, tg_table_name, v_row_id,
          tg_op, case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
          to_jsonb(new), auth.uid());
  return new;
end;
$$;

create trigger subcontract_scope_guard before insert or update on public.subcontract_scopes
for each row execute function sitedesk_private.subcontract_guard_scope();
create trigger subcontract_diary_guard before insert or update on public.subcontract_diary_days
for each row execute function sitedesk_private.subcontract_guard_diary_day();
create trigger subcontract_crew_guard before insert or update on public.subcontract_daily_crew
for each row execute function sitedesk_private.subcontract_guard_crew();
create trigger subcontract_work_item_guard before insert or update on public.subcontract_work_items
for each row execute function sitedesk_private.subcontract_guard_work_item();
create trigger subcontract_statement_guard before insert or update on public.subcontract_statements
for each row execute function sitedesk_private.subcontract_guard_statement();
create trigger subcontract_statement_row_guard before insert or update on public.subcontract_statement_rows
for each row execute function sitedesk_private.subcontract_guard_statement_row();
create trigger subcontract_owner_note_guard before insert on public.subcontract_owner_notes
for each row execute function sitedesk_private.subcontract_guard_note();

create trigger subcontract_scope_audit after insert or update on public.subcontract_scopes
for each row execute function sitedesk_private.subcontract_audit_write();
create trigger subcontract_member_audit after insert or update or delete on public.subcontract_scope_members
for each row execute function sitedesk_private.subcontract_audit_write();
create trigger subcontract_diary_audit after insert or update on public.subcontract_diary_days
for each row execute function sitedesk_private.subcontract_audit_write();
create trigger subcontract_crew_audit after insert or update on public.subcontract_daily_crew
for each row execute function sitedesk_private.subcontract_audit_write();
create trigger subcontract_work_item_audit after insert or update on public.subcontract_work_items
for each row execute function sitedesk_private.subcontract_audit_write();
create trigger subcontract_statement_audit after insert or update on public.subcontract_statements
for each row execute function sitedesk_private.subcontract_audit_write();
create trigger subcontract_statement_row_audit after insert or update on public.subcontract_statement_rows
for each row execute function sitedesk_private.subcontract_audit_write();
create trigger subcontract_owner_note_audit after insert on public.subcontract_owner_notes
for each row execute function sitedesk_private.subcontract_audit_write();

-- Explicit grants come before RLS: publishing the web app alone grants nothing.
revoke all on public.subcontract_scopes, public.subcontract_scope_members,
  public.subcontract_diary_days, public.subcontract_daily_crew,
  public.subcontract_work_items, public.subcontract_statements,
  public.subcontract_statement_rows, public.subcontract_owner_notes,
  public.subcontract_audit from public, anon, authenticated;

grant select on public.subcontract_scopes, public.subcontract_scope_members,
  public.subcontract_diary_days, public.subcontract_daily_crew,
  public.subcontract_work_items, public.subcontract_statements,
  public.subcontract_statement_rows, public.subcontract_owner_notes,
  public.subcontract_audit to authenticated;

grant insert (workspace_id, project_id, company_id, project_name, company_name)
  on public.subcontract_scopes to authenticated;
grant update (project_name, company_name, diary_closed_at)
  on public.subcontract_scopes to authenticated;
grant insert (scope_id, day, works, machinery)
  on public.subcontract_diary_days to authenticated;
grant update (scope_id, day, works, machinery, status)
  on public.subcontract_diary_days to authenticated;
grant insert (scope_id, day, worker_count, professions)
  on public.subcontract_daily_crew to authenticated;
grant update (scope_id, day, worker_count, professions)
  on public.subcontract_daily_crew to authenticated;
grant insert (scope_id, source_item_id, code, description, unit,
  contract_qty, unit_price, sort_order, is_active)
  on public.subcontract_work_items to authenticated;
grant update (scope_id, source_item_id, code, description, unit,
  contract_qty, unit_price, sort_order, is_active)
  on public.subcontract_work_items to authenticated;
grant insert (scope_id, period) on public.subcontract_statements to authenticated;
grant update (scope_id, period, status) on public.subcontract_statements to authenticated;
grant insert (statement_id, work_item_id, quantity)
  on public.subcontract_statement_rows to authenticated;
grant update (statement_id, work_item_id, quantity)
  on public.subcontract_statement_rows to authenticated;
grant insert (scope_id, day, body) on public.subcontract_owner_notes to authenticated;
-- No authenticated DELETE on any subcontract table; no write on the audit.

alter table public.subcontract_scopes enable row level security;
alter table public.subcontract_scope_members enable row level security;
alter table public.subcontract_diary_days enable row level security;
alter table public.subcontract_daily_crew enable row level security;
alter table public.subcontract_work_items enable row level security;
alter table public.subcontract_statements enable row level security;
alter table public.subcontract_statement_rows enable row level security;
alter table public.subcontract_owner_notes enable row level security;
alter table public.subcontract_audit enable row level security;

create policy subcontract_scope_read on public.subcontract_scopes
for select to authenticated
-- The owner branch uses workspace_id directly so INSERT ... RETURNING can
-- see a scope created in this statement (a STABLE self-lookup cannot).
using (sitedesk_private.subcontract_main_workspace(workspace_id)
  or sitedesk_private.subcontract_can_read(id));
create policy subcontract_scope_create on public.subcontract_scopes
for insert to authenticated
with check (created_by = (select auth.uid())
  and sitedesk_private.subcontract_main_workspace(workspace_id));
create policy subcontract_scope_admin_update on public.subcontract_scopes
for update to authenticated
using (sitedesk_private.subcontract_main(id))
with check (sitedesk_private.subcontract_main(id));

create policy subcontract_member_read on public.subcontract_scope_members
for select to authenticated
using (user_id = (select auth.uid())
  or sitedesk_private.subcontract_main(scope_id));

create policy subcontract_diary_read on public.subcontract_diary_days
for select to authenticated
using (sitedesk_private.subcontract_can_read(scope_id));
create policy subcontract_diary_create on public.subcontract_diary_days
for insert to authenticated
with check (created_by = (select auth.uid()) and
  (sitedesk_private.subcontract_supplier(scope_id)
    or sitedesk_private.subcontract_main(scope_id)));
create policy subcontract_diary_update on public.subcontract_diary_days
for update to authenticated
using (status = 'draft' and
  (sitedesk_private.subcontract_supplier(scope_id)
    or sitedesk_private.subcontract_main(scope_id)))
with check (sitedesk_private.subcontract_supplier(scope_id)
  or sitedesk_private.subcontract_main(scope_id));

create policy subcontract_crew_read on public.subcontract_daily_crew
for select to authenticated
using (sitedesk_private.subcontract_can_read(scope_id));
create policy subcontract_crew_create on public.subcontract_daily_crew
for insert to authenticated
with check (created_by = (select auth.uid()) and
  (sitedesk_private.subcontract_supplier(scope_id)
    or sitedesk_private.subcontract_main(scope_id)));
create policy subcontract_crew_update on public.subcontract_daily_crew
for update to authenticated
using (sitedesk_private.subcontract_supplier(scope_id)
  or sitedesk_private.subcontract_main(scope_id))
with check (sitedesk_private.subcontract_supplier(scope_id)
  or sitedesk_private.subcontract_main(scope_id));

create policy subcontract_work_items_read on public.subcontract_work_items
for select to authenticated
using (sitedesk_private.subcontract_can_read(scope_id));
create policy subcontract_work_items_create on public.subcontract_work_items
for insert to authenticated
with check (created_by = (select auth.uid())
  and sitedesk_private.subcontract_main(scope_id));
create policy subcontract_work_items_update on public.subcontract_work_items
for update to authenticated
using (sitedesk_private.subcontract_main(scope_id))
with check (sitedesk_private.subcontract_main(scope_id));

create policy subcontract_statements_read on public.subcontract_statements
for select to authenticated
using (sitedesk_private.subcontract_can_read(scope_id));
create policy subcontract_statements_create on public.subcontract_statements
for insert to authenticated
with check (created_by = (select auth.uid()) and status = 'draft' and
  (sitedesk_private.subcontract_supplier(scope_id)
    or sitedesk_private.subcontract_main(scope_id)));
create policy subcontract_statements_update on public.subcontract_statements
for update to authenticated
using (status <> 'closed' and
  (sitedesk_private.subcontract_supplier(scope_id)
    or sitedesk_private.subcontract_main(scope_id)))
with check (sitedesk_private.subcontract_supplier(scope_id)
  or sitedesk_private.subcontract_main(scope_id));

create policy subcontract_statement_rows_read on public.subcontract_statement_rows
for select to authenticated
using (sitedesk_private.subcontract_can_read(
  sitedesk_private.subcontract_statement_scope(statement_id)));
create policy subcontract_statement_rows_create on public.subcontract_statement_rows
for insert to authenticated
with check (created_by = (select auth.uid())
  and sitedesk_private.subcontract_statement_writable(statement_id));
create policy subcontract_statement_rows_update on public.subcontract_statement_rows
for update to authenticated
using (sitedesk_private.subcontract_statement_writable(statement_id))
with check (sitedesk_private.subcontract_statement_writable(statement_id));

create policy subcontract_notes_read on public.subcontract_owner_notes
for select to authenticated
using (sitedesk_private.subcontract_can_read(scope_id));
create policy subcontract_notes_create on public.subcontract_owner_notes
for insert to authenticated
with check (created_by = (select auth.uid())
  and sitedesk_private.subcontract_main(scope_id));

create policy subcontract_audit_read on public.subcontract_audit
for select to authenticated
using (sitedesk_private.subcontract_can_read(scope_id));

-- Helpers are callable from RLS but not exposed as REST endpoints.
revoke all on all functions in schema sitedesk_private from public, anon;
grant execute on all functions in schema sitedesk_private to authenticated;

-- Resolve an existing, confirmed Auth account by e-mail. Never send or set
-- another person's password from the admin UI.
create function sitedesk_private.subcontract_add_member_impl(
  p_scope_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
  v_email text := lower(trim(p_email));
  v_members jsonb;
  v_shape_valid boolean;
  v_caller_seen boolean;
  v_full_member boolean;
begin
  select s.workspace_id into v_workspace_id
  from public.subcontract_scopes s where s.id = p_scope_id;
  if not found or not sitedesk_private.subcontract_owner(p_scope_id) then
    raise exception 'Priradenie účtov môže spravovať iba vlastník' using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Zadaj platný e-mail subdodávateľa';
  end if;
  select u.id into v_user_id from auth.users u
  where lower(u.email) = v_email and u.email_confirmed_at is not null;
  if v_user_id is null then
    raise exception 'Používateľ si musí najprv vytvoriť a potvrdiť vlastný účet';
  end if;

  -- Fail closed if the existing full-workspace member list cannot be read.
  -- Verify this RPC's JSON shape in the target database before deployment.
  execute 'select coalesce(jsonb_agg(to_jsonb(m)), ''[]''::jsonb)
           from public.sitedesk_list_members($1) as m'
    into v_members using v_workspace_id;
  with raw as (
    select case when entry ? 'm' then entry->'m' else entry end as payload
    from jsonb_array_elements(coalesce(v_members, '[]'::jsonb)) as input(entry)
  ), normalized as (
    select member as entry from raw
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(raw.payload) = 'array' then raw.payload
           else jsonb_build_array(raw.payload) end
    ) as expanded(member)
  )
  select coalesce(bool_and(jsonb_typeof(entry) = 'object'
           and nullif(entry->>'user_id', '') is not null
           and nullif(entry->>'email', '') is not null), true),
         coalesce(bool_or(entry->>'user_id' = auth.uid()::text), false),
         coalesce(bool_or(entry->>'user_id' = v_user_id::text
           or lower(entry->>'email') = v_email), false)
    into v_shape_valid, v_caller_seen, v_full_member from normalized;
  if not v_shape_valid or not v_caller_seen then
    raise exception 'Tvar zoznamu členov pracovného priestoru sa zmenil; pozvanie bolo bezpečne zastavené'
      using errcode = '42501';
  end if;
  if v_full_member then
    raise exception 'Tento účet už má prístup k celému pracovnému priestoru. Použi samostatný účet subdodávateľa.'
      using errcode = '42501';
  end if;

  insert into public.subcontract_scope_members(scope_id, user_id, email, role, created_by)
  values (p_scope_id, v_user_id, v_email, 'supplier_writer', auth.uid())
  on conflict (scope_id, user_id) do update
    set email = excluded.email, role = 'supplier_writer';
  return v_user_id;
end;
$$;

create function public.subcontract_add_member(p_scope_id uuid, p_email text)
returns uuid language sql security invoker set search_path = '' as $$
  select sitedesk_private.subcontract_add_member_impl(p_scope_id, p_email);
$$;

create function sitedesk_private.subcontract_remove_member_impl(
  p_scope_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not sitedesk_private.subcontract_owner(p_scope_id) then
    raise exception 'Prístup môže odobrať iba vlastník' using errcode = '42501';
  end if;
  delete from public.subcontract_scope_members
  where scope_id = p_scope_id and user_id = p_user_id;
end;
$$;

create function public.subcontract_remove_member(p_scope_id uuid, p_user_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select sitedesk_private.subcontract_remove_member_impl(p_scope_id, p_user_id);
$$;

create function public.subcontract_close_day(p_scope_id uuid, p_day date)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_diary_closed_at timestamptz;
begin
  if not sitedesk_private.subcontract_main(p_scope_id) then
    raise exception 'Deň môže uzatvoriť iba hlavný zhotoviteľ' using errcode = '42501';
  end if;
  select s.diary_closed_at into v_diary_closed_at
  from public.subcontract_scopes s where s.id = p_scope_id for update;
  if not found then raise exception 'Denník stavby neexistuje'; end if;
  if v_diary_closed_at is not null then return; end if;
  if not exists (
    select 1 from public.subcontract_diary_days d
    where d.scope_id = p_scope_id and d.day = p_day
  ) then
    insert into public.subcontract_diary_days(scope_id, day, works, machinery)
      values (p_scope_id, p_day, '', '');
  end if;
  update public.subcontract_diary_days set status = 'closed'
  where scope_id = p_scope_id and day = p_day and status = 'draft';
end;
$$;

create function public.subcontract_close_diary(p_scope_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not sitedesk_private.subcontract_main(p_scope_id) then
    raise exception 'Denník môže uzatvoriť iba hlavný zhotoviteľ' using errcode = '42501';
  end if;
  perform 1 from public.subcontract_scopes where id = p_scope_id for update;
  if not found then raise exception 'Denník stavby neexistuje'; end if;
  update public.subcontract_diary_days set status = 'closed'
  where scope_id = p_scope_id and status = 'draft';
  update public.subcontract_scopes set diary_closed_at = pg_catalog.now()
  where id = p_scope_id and diary_closed_at is null;
end;
$$;

create function public.subcontract_submit_statement(p_statement_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_scope_id uuid;
begin
  select s.scope_id into v_scope_id from public.subcontract_statements s
  where s.id = p_statement_id for update;
  if not found or not sitedesk_private.subcontract_supplier(v_scope_id) then
    raise exception 'Súpis môže odoslať len priradená firma' using errcode = '42501';
  end if;
  update public.subcontract_statements set status = 'submitted'
  where id = p_statement_id and status = 'draft';
end;
$$;

create function public.subcontract_close_statement(p_statement_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_scope_id uuid;
begin
  select s.scope_id into v_scope_id from public.subcontract_statements s
  where s.id = p_statement_id for update;
  if not found or not sitedesk_private.subcontract_main(v_scope_id) then
    raise exception 'Súpis môže uzatvoriť iba hlavný zhotoviteľ' using errcode = '42501';
  end if;
  update public.subcontract_statements set status = 'closed'
  where id = p_statement_id and status <> 'closed';
end;
$$;

revoke execute on function public.subcontract_add_member(uuid, text),
  public.subcontract_remove_member(uuid, uuid),
  public.subcontract_close_day(uuid, date),
  public.subcontract_close_diary(uuid),
  public.subcontract_submit_statement(uuid),
  public.subcontract_close_statement(uuid) from public, anon;
grant execute on function public.subcontract_add_member(uuid, text),
  public.subcontract_remove_member(uuid, uuid),
  public.subcontract_close_day(uuid, date),
  public.subcontract_close_diary(uuid),
  public.subcontract_submit_statement(uuid),
  public.subcontract_close_statement(uuid) to authenticated;
grant execute on function sitedesk_private.subcontract_add_member_impl(uuid, text),
  sitedesk_private.subcontract_remove_member_impl(uuid, uuid) to authenticated;
commit;
