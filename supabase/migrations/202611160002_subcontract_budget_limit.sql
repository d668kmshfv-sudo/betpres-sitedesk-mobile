-- Keep every subcontract item within its published contract quantity.
-- The check counts owner-reviewed quantities when they exist and serializes
-- simultaneous writes to the same item from separate devices.
begin;

create function sitedesk_private.subcontract_guard_item_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_used numeric(18,3);
begin
  if new.contract_qty >= old.contract_qty then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 0));
  select coalesce(sum(coalesce(r.reviewed_quantity, r.quantity)), 0)
  into v_used from public.subcontract_statement_rows r
  where r.work_item_id = new.id;
  if new.contract_qty < v_used then
    raise exception 'Zmluvné množstvo položky nemožno znížiť pod už vykázaných %.', v_used;
  end if;
  return new;
end;
$$;

create trigger zzzz_subcontract_item_budget_guard
before update of contract_qty on public.subcontract_work_items
for each row execute function sitedesk_private.subcontract_guard_item_budget();

create function sitedesk_private.subcontract_guard_row_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_budget numeric(18,3);
  v_other numeric(18,3);
  v_exclude_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.work_item_id::text, 0));
  select i.contract_qty into v_budget from public.subcontract_work_items i
  where i.id = new.work_item_id for share;
  if not found then raise exception 'Položka súpisu neexistuje'; end if;
  if tg_op = 'UPDATE' then v_exclude_id := old.id; end if;
  select coalesce(sum(coalesce(r.reviewed_quantity, r.quantity)), 0)
  into v_other from public.subcontract_statement_rows r
  where r.work_item_id = new.work_item_id and r.id is distinct from v_exclude_id;
  if v_other + coalesce(new.reviewed_quantity, new.quantity) > v_budget then
    raise exception 'Položku nemožno prečerpať. V ostatných mesiacoch je už vykázaných %, zmluvné množstvo je %.',
      v_other, v_budget;
  end if;
  return new;
end;
$$;

-- Runs after the existing identity and review-field guards.
create trigger zzzz_subcontract_row_budget_guard
before insert or update on public.subcontract_statement_rows
for each row execute function sitedesk_private.subcontract_guard_row_budget();

create function sitedesk_private.subcontract_guard_submit_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_item_id uuid; v_budget numeric(18,3); v_used numeric(18,3);
begin
  if old.status <> 'draft' or new.status <> 'submitted' then return new; end if;
  for v_item_id in
    select distinct r.work_item_id from public.subcontract_statement_rows r
    where r.statement_id = new.id order by r.work_item_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_item_id::text, 0));
    select i.contract_qty into v_budget from public.subcontract_work_items i
    where i.id = v_item_id for share;
    select coalesce(sum(coalesce(r.reviewed_quantity, r.quantity)), 0)
    into v_used from public.subcontract_statement_rows r
    where r.work_item_id = v_item_id;
    if v_used > v_budget then
      raise exception 'Súpis nemožno odoslať. Položka prekračuje zmluvné množstvo %; vykázaných je %.',
        v_budget, v_used;
    end if;
  end loop;
  return new;
end;
$$;

create trigger zzzz_subcontract_submit_budget_guard
before update of status on public.subcontract_statements
for each row execute function sitedesk_private.subcontract_guard_submit_budget();

revoke all on function sitedesk_private.subcontract_guard_item_budget(),
  sitedesk_private.subcontract_guard_row_budget(),
  sitedesk_private.subcontract_guard_submit_budget()
from public, anon, authenticated;

commit;
