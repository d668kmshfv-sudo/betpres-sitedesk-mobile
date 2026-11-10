-- Contractor review of quantities proposed by a subcontractor.
-- Apply after 202611090001_subcontract_portal.sql.
begin;

do $$ begin
 if to_regclass('public.subcontract_statement_rows') is null
    or to_regprocedure('sitedesk_private.subcontract_main(uuid)') is null then
   raise exception 'Subcontract portal migration is required first';
 end if;
end $$;

alter table public.subcontract_statement_rows
 add column reviewed_quantity numeric(18,3) check (reviewed_quantity >= 0),
 add column review_note text not null default '' check (length(review_note) <= 2000),
 add column reviewed_by uuid references auth.users(id),
 add column reviewed_at timestamptz;
alter table public.subcontract_statement_rows
 add column approved_line_total numeric(22,2) generated always as
   (round(coalesce(reviewed_quantity,quantity) * unit_price_snapshot, 2)) stored;
grant update (reviewed_quantity, review_note)
 on public.subcontract_statement_rows to authenticated;

create function sitedesk_private.subcontract_review_field_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 v_scope_id uuid;
 v_status text;
 v_review_changed boolean;
begin
 if tg_op = 'INSERT' then
   select s.status into v_status from public.subcontract_statements s
   where s.id = new.statement_id for share;
   if v_status <> 'draft' then
     raise exception 'Do odoslaného súpisu nemožno pridať ďalší riadok'
       using errcode = '42501';
   end if;
   if new.reviewed_quantity is not null or new.review_note <> ''
      or new.reviewed_by is not null or new.reviewed_at is not null then
     raise exception 'Schválené množstvo nastavuje len hlavný zhotoviteľ'
       using errcode = '42501';
   end if;
   return new;
 end if;

 select s.scope_id, s.status into v_scope_id, v_status
 from public.subcontract_statements s where s.id = new.statement_id;
 if not found then raise exception 'Súpis neexistuje'; end if;

 if v_status <> 'draft' and new.quantity is distinct from old.quantity then
   raise exception 'Odoslané množstvo subdodávky sa spätne nemení'
     using errcode = '42501';
 end if;
 v_review_changed := new.reviewed_quantity is distinct from old.reviewed_quantity
   or new.review_note is distinct from old.review_note;
 if v_review_changed then
   if v_status <> 'submitted' or not sitedesk_private.subcontract_main(v_scope_id) then
     raise exception 'Množstvo môže revidovať len hlavný zhotoviteľ po odoslaní súpisu'
       using errcode = '42501';
   end if;
   new.reviewed_by := auth.uid();
   new.reviewed_at := pg_catalog.now();
 elsif (new.reviewed_by, new.reviewed_at)
       is distinct from (old.reviewed_by, old.reviewed_at) then
   raise exception 'Údaje o revízii nastavuje databáza' using errcode = '42501';
 end if;
 return new;
end;
$$;

create trigger zzz_subcontract_review_field_guard
before insert or update on public.subcontract_statement_rows
for each row execute function sitedesk_private.subcontract_review_field_guard();

create function sitedesk_private.subcontract_approval_transition_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.status = 'draft' and new.status = 'closed' then
   raise exception 'Najprv musí subdodávka odoslať mesačný súpis na schválenie'
     using errcode = '42501';
 end if;
 if old.status = 'submitted' and new.status = 'closed'
   and not exists(select 1 from public.subcontract_statement_rows r
     where r.statement_id = old.id) then
   raise exception 'Prázdny súpis nie je možné schváliť'
     using errcode = '42501';
 end if;
 return new;
end;
$$;
create trigger zzz_subcontract_approval_transition_guard
before update on public.subcontract_statements
for each row execute function sitedesk_private.subcontract_approval_transition_guard();

-- The owner can approve only a statement the supplier has submitted.
-- Closing a draft directly through the REST RPC must not bypass review.
create or replace function public.subcontract_close_statement(p_statement_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_scope_id uuid; v_status text;
begin
 select s.scope_id, s.status into v_scope_id, v_status
 from public.subcontract_statements s where s.id = p_statement_id for update;
 if not found or not sitedesk_private.subcontract_main(v_scope_id) then
   raise exception 'Súpis môže uzatvoriť iba hlavný zhotoviteľ' using errcode = '42501';
 end if;
 if v_status <> 'submitted' then
   raise exception 'Schváliť sa dá iba súpis odoslaný subdodávkou' using errcode = '42501';
 end if;
 update public.subcontract_statements set status = 'closed'
 where id = p_statement_id and status = 'submitted';
end;
$$;

revoke all on function sitedesk_private.subcontract_review_field_guard(),
 sitedesk_private.subcontract_approval_transition_guard()
 from public, anon, authenticated;

commit;
