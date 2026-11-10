-- Separate, read-only diary portal for a construction supervisor or designer.
-- Reviewers can append a reply only to a call addressed to their own account.
-- Apply after checking the existing BETPRES workspace RPC signatures.
begin;

do $$ begin
 if to_regclass('public.sitedesk_workspaces') is null
    or to_regprocedure('public.sitedesk_current_role(uuid)') is null
    or to_regprocedure('public.sitedesk_list_members(uuid)') is null then
   raise exception 'BETPRES workspace and role RPCs are required';
 end if;
end $$;

create schema if not exists sitedesk_private;
revoke all on schema sitedesk_private from public, anon;
grant usage on schema sitedesk_private to authenticated;

create table public.diary_review_scopes (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.sitedesk_workspaces(id),
 project_id text not null check (length(trim(project_id)) between 1 and 120),
 project_name text not null check (length(trim(project_name)) between 1 and 240),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique (workspace_id, project_id)
);

create table public.diary_review_members (
 scope_id uuid not null references public.diary_review_scopes(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 email text not null,
 role text not null default 'supervisor' check (role in ('supervisor','designer','investor','reviewer')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (scope_id, user_id)
);
create index diary_review_members_user_idx on public.diary_review_members(user_id,scope_id);

create table public.diary_review_days (
 id uuid primary key default gen_random_uuid(),
 scope_id uuid not null references public.diary_review_scopes(id),
 day date not null,
 weather jsonb not null default '{}'::jsonb check (jsonb_typeof(weather)='object'),
 works jsonb not null default '[]'::jsonb check (jsonb_typeof(works)='array'),
 crew jsonb not null default '[]'::jsonb check (jsonb_typeof(crew)='array'),
 machines jsonb not null default '[]'::jsonb check (jsonb_typeof(machines)='array'),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(scope_id,day),
 check (octet_length(weather::text)+octet_length(works::text)+octet_length(crew::text)+octet_length(machines::text)<=1048576)
);

create table public.diary_review_calls (
 id uuid primary key default gen_random_uuid(),
 scope_id uuid not null references public.diary_review_scopes(id),
 source_id text not null check (length(trim(source_id)) between 1 and 160),
 day date not null,
 assignee_user_id uuid not null references auth.users(id),
 recipient text not null default '',
 subject text not null check (length(trim(subject)) between 1 and 2000),
 note text not null default '' check (length(note)<=8000),
 due_at timestamptz,
 status text not null default 'open' check (status in ('open','closed')),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 unique(scope_id,source_id)
);
create index diary_review_calls_assignee_idx on public.diary_review_calls(assignee_user_id,day desc);

create table public.diary_review_replies (
 id uuid primary key default gen_random_uuid(),
 call_id uuid not null references public.diary_review_calls(id),
 user_id uuid not null default auth.uid() references auth.users(id),
 decision text not null check (decision in ('acknowledged','accepted','needs_action')),
 body text not null check (length(trim(body)) between 1 and 8000),
 created_at timestamptz not null default now()
);
create index diary_review_replies_call_idx on public.diary_review_replies(call_id,created_at);

create function sitedesk_private.review_main_workspace(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
   and coalesce(public.sitedesk_current_role(p_workspace_id)::text in ('owner','editor'),false);
$$;
create function sitedesk_private.review_owner_workspace(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
   and coalesce(public.sitedesk_current_role(p_workspace_id)::text='owner',false);
$$;
create function sitedesk_private.review_main(p_scope_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.diary_review_scopes s where s.id=p_scope_id
   and sitedesk_private.review_main_workspace(s.workspace_id));
$$;
create function sitedesk_private.review_member(p_scope_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.diary_review_members m
   where m.scope_id=p_scope_id and m.user_id=(select auth.uid()));
$$;
create function sitedesk_private.review_assigned(p_call_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(
   select 1 from public.diary_review_calls c
   where c.id=p_call_id and c.assignee_user_id=(select auth.uid())
     and sitedesk_private.review_member(c.scope_id));
$$;
create function sitedesk_private.review_can_read_call(p_call_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.diary_review_calls c where c.id=p_call_id
   and (sitedesk_private.review_main(c.scope_id)
     or sitedesk_private.review_assigned(p_call_id)));
$$;

create function sitedesk_private.review_guard_day()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not sitedesk_private.review_main(new.scope_id) then
   raise exception 'Denník môže zverejniť len hlavný zhotoviteľ' using errcode='42501';
 end if;
 if tg_op='UPDATE' and (new.id,new.scope_id,new.day)
   is distinct from (old.id,old.scope_id,old.day) then
   raise exception 'Deň a stavba sú nemenné' using errcode='42501';
 end if;
 new.updated_by:=auth.uid();new.updated_at:=pg_catalog.now();return new;
end;
$$;
create function sitedesk_private.review_guard_call()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not sitedesk_private.review_main(new.scope_id) then
   raise exception 'Výzvu môže zverejniť len hlavný zhotoviteľ' using errcode='42501';
 end if;
 if not exists(select 1 from public.diary_review_members m
   where m.scope_id=new.scope_id and m.user_id=new.assignee_user_id) then
   raise exception 'Adresát musí mať prístup k tomuto denníku' using errcode='42501';
 end if;
 if tg_op='UPDATE' and (new.id,new.scope_id,new.source_id)
   is distinct from (old.id,old.scope_id,old.source_id) then
   raise exception 'Identita výzvy je nemenná' using errcode='42501';
 end if;
 if tg_op='UPDATE' and new.assignee_user_id is distinct from old.assignee_user_id
   and exists(select 1 from public.diary_review_replies r where r.call_id=old.id) then
   raise exception 'Výzvu s odpoveďou už nemožno presunúť na iného príjemcu'
     using errcode='42501';
 end if;
 new.updated_by:=auth.uid();new.updated_at:=pg_catalog.now();return new;
end;
$$;
create function sitedesk_private.review_guard_reply()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status text;
begin
 if new.user_id is distinct from auth.uid()
    or not sitedesk_private.review_assigned(new.call_id) then
   raise exception 'Odpovedať môže iba adresát výzvy' using errcode='42501';
 end if;
 select c.status into v_status from public.diary_review_calls c
   where c.id=new.call_id for share;
 if v_status<>'open' then
   raise exception 'Výzva je uzatvorená' using errcode='42501';
 end if;
 new.created_at:=pg_catalog.now();return new;
end;
$$;
create trigger diary_review_day_guard before insert or update on public.diary_review_days
 for each row execute function sitedesk_private.review_guard_day();
create trigger diary_review_call_guard before insert or update on public.diary_review_calls
 for each row execute function sitedesk_private.review_guard_call();
create trigger diary_review_reply_guard before insert on public.diary_review_replies
 for each row execute function sitedesk_private.review_guard_reply();

create function sitedesk_private.review_add_member_impl(p_scope_id uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_workspace_id uuid;v_user_id uuid;v_email text:=lower(trim(p_email));
 v_members jsonb;v_shape_valid boolean;v_caller_seen boolean;v_full_member boolean;
begin
 select s.workspace_id into v_workspace_id from public.diary_review_scopes s where s.id=p_scope_id;
 if not found or not sitedesk_private.review_owner_workspace(v_workspace_id) then
   raise exception 'Prístup môže udeliť len vlastník' using errcode='42501';
 end if;
 if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
   or p_role not in ('supervisor','designer','investor','reviewer') then
   raise exception 'Zadaj platný e-mail a rolu';
 end if;
 select u.id into v_user_id from auth.users u
   where lower(u.email)=v_email and u.email_confirmed_at is not null;
 if v_user_id is null then
   raise exception 'Používateľ si musí najprv vytvoriť a potvrdiť vlastný účet';
 end if;
 execute 'select coalesce(jsonb_agg(to_jsonb(m)), ''[]''::jsonb)
          from public.sitedesk_list_members($1) as m'
   into v_members using v_workspace_id;
 with raw as (
   select case when entry ? 'm' then entry->'m' else entry end as payload
   from jsonb_array_elements(coalesce(v_members,'[]'::jsonb)) as input(entry)
 ), normalized as (
   select member as entry from raw
   cross join lateral jsonb_array_elements(
     case when jsonb_typeof(raw.payload)='array' then raw.payload
          else jsonb_build_array(raw.payload) end) as expanded(member)
 )
 select coalesce(bool_and(jsonb_typeof(entry)='object'
        and nullif(entry->>'user_id','') is not null
        and nullif(entry->>'email','') is not null),true),
        coalesce(bool_or(entry->>'user_id'=auth.uid()::text),false),
        coalesce(bool_or(entry->>'user_id'=v_user_id::text
          or lower(entry->>'email')=v_email),false)
 into v_shape_valid,v_caller_seen,v_full_member from normalized;
 if not v_shape_valid or not v_caller_seen then
   raise exception 'Tvar zoznamu tímu sa zmenil; pozvanie bolo zastavené' using errcode='42501';
 end if;
 if v_full_member then
   raise exception 'Tento účet už má prístup k celému pracovnému priestoru. Použi oddelený účet.' using errcode='42501';
 end if;
 insert into public.diary_review_members(scope_id,user_id,email,role,created_by)
 values(p_scope_id,v_user_id,v_email,p_role,auth.uid())
 on conflict(scope_id,user_id) do update set email=excluded.email,role=excluded.role;
 return v_user_id;
end;
$$;
create function public.diary_review_add_member(p_scope_id uuid,p_email text,p_role text)
returns uuid language sql security invoker set search_path='' as $$
 select sitedesk_private.review_add_member_impl(p_scope_id,p_email,p_role);
$$;
create function public.diary_review_remove_member(p_scope_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_workspace_id uuid;
begin
 select s.workspace_id into v_workspace_id from public.diary_review_scopes s where s.id=p_scope_id;
 if not found or not sitedesk_private.review_owner_workspace(v_workspace_id) then
   raise exception 'Prístup môže odobrať len vlastník' using errcode='42501';
 end if;
 delete from public.diary_review_members where scope_id=p_scope_id and user_id=p_user_id;
end;
$$;

alter table public.diary_review_scopes enable row level security;
alter table public.diary_review_members enable row level security;
alter table public.diary_review_days enable row level security;
alter table public.diary_review_calls enable row level security;
alter table public.diary_review_replies enable row level security;

create policy diary_review_scopes_read on public.diary_review_scopes for select to authenticated
 using(sitedesk_private.review_main_workspace(workspace_id)
   or sitedesk_private.review_member(id));
create policy diary_review_scopes_create on public.diary_review_scopes for insert to authenticated
 with check(created_by=(select auth.uid()) and sitedesk_private.review_main_workspace(workspace_id));
create policy diary_review_members_read on public.diary_review_members for select to authenticated
 using(user_id=(select auth.uid()) or sitedesk_private.review_main(scope_id));
create policy diary_review_days_read on public.diary_review_days for select to authenticated
 using(sitedesk_private.review_main(scope_id) or sitedesk_private.review_member(scope_id));
create policy diary_review_days_create on public.diary_review_days for insert to authenticated
 with check(sitedesk_private.review_main(scope_id));
create policy diary_review_days_update on public.diary_review_days for update to authenticated
 using(sitedesk_private.review_main(scope_id)) with check(sitedesk_private.review_main(scope_id));
create policy diary_review_calls_read on public.diary_review_calls for select to authenticated
 using(sitedesk_private.review_main(scope_id)
   or (assignee_user_id=(select auth.uid()) and sitedesk_private.review_member(scope_id)));
create policy diary_review_calls_create on public.diary_review_calls for insert to authenticated
 with check(sitedesk_private.review_main(scope_id));
create policy diary_review_calls_update on public.diary_review_calls for update to authenticated
 using(sitedesk_private.review_main(scope_id)) with check(sitedesk_private.review_main(scope_id));
create policy diary_review_replies_read on public.diary_review_replies for select to authenticated
 using(sitedesk_private.review_can_read_call(call_id));
create policy diary_review_replies_create on public.diary_review_replies for insert to authenticated
 with check(user_id=(select auth.uid()) and sitedesk_private.review_assigned(call_id));

revoke all on public.diary_review_scopes,public.diary_review_members,
 public.diary_review_days,public.diary_review_calls,public.diary_review_replies
 from public,anon,authenticated;
grant select on public.diary_review_scopes,public.diary_review_members,
 public.diary_review_days,public.diary_review_calls,public.diary_review_replies to authenticated;
grant insert on public.diary_review_scopes,public.diary_review_days,
 public.diary_review_calls,public.diary_review_replies to authenticated;
grant update on public.diary_review_days,public.diary_review_calls to authenticated;

revoke execute on function public.diary_review_add_member(uuid,text,text),
 public.diary_review_remove_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.diary_review_add_member(uuid,text,text),
 public.diary_review_remove_member(uuid,uuid) to authenticated;
revoke all on function sitedesk_private.review_add_member_impl(uuid,text,text),
 sitedesk_private.review_main_workspace(uuid),sitedesk_private.review_owner_workspace(uuid),
 sitedesk_private.review_main(uuid),sitedesk_private.review_member(uuid),
 sitedesk_private.review_assigned(uuid),sitedesk_private.review_can_read_call(uuid),
 sitedesk_private.review_guard_day(),sitedesk_private.review_guard_call(),
 sitedesk_private.review_guard_reply() from public,anon,authenticated;
grant execute on function sitedesk_private.review_add_member_impl(uuid,text,text),
 sitedesk_private.review_main_workspace(uuid),sitedesk_private.review_owner_workspace(uuid),
 sitedesk_private.review_main(uuid),sitedesk_private.review_member(uuid),
 sitedesk_private.review_assigned(uuid),sitedesk_private.review_can_read_call(uuid)
 to authenticated;

commit;
