-- An invited person can append an attributed entry to the diary of one
-- assigned construction project. Existing owner records remain immutable to them.
begin;

create table public.diary_review_entries (
 id uuid primary key default gen_random_uuid(),
 scope_id uuid not null references public.diary_review_scopes(id),
 day date not null,
 body text not null check (length(trim(body)) between 1 and 8000),
 author_user_id uuid not null default auth.uid() references auth.users(id),
 author_email text not null default '',
 author_role text not null default '',
 created_at timestamptz not null default now()
);
create index diary_review_entries_scope_day_idx
 on public.diary_review_entries(scope_id,day desc,created_at,id);

create function sitedesk_private.review_guard_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_email text; v_role text;
begin
 select lower(u.email), m.role into v_email,v_role
 from public.diary_review_members m
 join auth.users u on u.id=m.user_id
 where m.scope_id=new.scope_id and m.user_id=auth.uid()
   and u.email_confirmed_at is not null;
 if not found then
  raise exception 'Zápis môže pridať iba pozvaný používateľ tejto stavby'
   using errcode='42501';
 end if;
 new.author_user_id:=auth.uid();
 new.author_email:=v_email;
 new.author_role:=v_role;
 new.created_at:=pg_catalog.now();
 return new;
end;
$$;
create trigger diary_review_entry_guard before insert on public.diary_review_entries
 for each row execute function sitedesk_private.review_guard_entry();

alter table public.diary_review_entries enable row level security;
create policy diary_review_entries_read on public.diary_review_entries
 for select to authenticated
 using(sitedesk_private.review_main(scope_id) or sitedesk_private.review_member(scope_id));
create policy diary_review_entries_create on public.diary_review_entries
 for insert to authenticated
 with check(author_user_id=(select auth.uid()) and sitedesk_private.review_member(scope_id));

revoke all on public.diary_review_entries from public,anon,authenticated;
grant select on public.diary_review_entries to authenticated;
grant insert(scope_id,day,body) on public.diary_review_entries to authenticated;
revoke all on function sitedesk_private.review_guard_entry() from public,anon,authenticated;

commit;
