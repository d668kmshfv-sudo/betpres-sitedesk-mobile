-- Existing work measured in the main BETPRES statement before a supplier
-- starts using the separate portal. It remains visible without creating
-- fictitious supplier submissions for historical months.
begin;

alter table public.subcontract_work_items
  add column opening_qty numeric(18,3) not null default 0,
  add column opening_amount numeric(22,2) not null default 0,
  add column opening_before_period text;

alter table public.subcontract_work_items
  add constraint subcontract_opening_qty_nonnegative
    check (opening_qty >= 0),
  add constraint subcontract_opening_amount_nonnegative
    check (opening_amount >= 0),
  add constraint subcontract_opening_period_valid
    check (opening_before_period is null or opening_before_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create or replace function sitedesk_private.subcontract_guard_item_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_used numeric(18,3);
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text, 0));
  select coalesce(sum(coalesce(r.reviewed_quantity, r.quantity)), 0)
    into v_used from public.subcontract_statement_rows r
    where r.work_item_id = new.id;
  if new.opening_before_period is not null and exists (
    select 1 from public.subcontract_statement_rows r
      join public.subcontract_statements s on s.id = r.statement_id
      where r.work_item_id = new.id and s.period < new.opening_before_period
        and coalesce(r.reviewed_quantity, r.quantity) > 0
  ) then
    raise exception 'Počiatočné obdobie nemožno posunúť za už vykázaný mesiac subdodávky.';
  end if;
  if v_used > 0 and new.opening_qty + v_used > new.contract_qty then
    raise exception 'Počiatočné a vykázané množstvo položky (%) prekračuje zmluvné množstvo (%).',
      new.opening_qty + v_used, new.contract_qty;
  end if;
  return new;
end;
$$;

drop trigger zzzz_subcontract_item_budget_guard on public.subcontract_work_items;
create trigger zzzz_subcontract_item_budget_guard
before update of contract_qty, opening_qty, opening_amount, opening_before_period
on public.subcontract_work_items
for each row execute function sitedesk_private.subcontract_guard_item_budget();

create or replace function sitedesk_private.subcontract_guard_row_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_budget numeric(18,3);
  v_other numeric(18,3);
  v_exclude_id uuid;
  v_first_period text;
  v_period text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.work_item_id::text, 0));
  select greatest(0, i.contract_qty - i.opening_qty), i.opening_before_period
    into v_budget, v_first_period
    from public.subcontract_work_items i
    where i.id = new.work_item_id for share;
  if not found then raise exception 'Položka súpisu neexistuje'; end if;
  select s.period into v_period from public.subcontract_statements s
    where s.id = new.statement_id;
  if v_first_period is not null and v_period < v_first_period
    and coalesce(new.reviewed_quantity, new.quantity) > 0 then
    raise exception 'Položku možno vypĺňať až od mesiaca %. Staršie množstvá už prevzal hlavný zhotoviteľ.', v_first_period;
  end if;
  if tg_op = 'UPDATE' then v_exclude_id := old.id; end if;
  select coalesce(sum(coalesce(r.reviewed_quantity, r.quantity)), 0)
    into v_other from public.subcontract_statement_rows r
    where r.work_item_id = new.work_item_id and r.id is distinct from v_exclude_id;
  if v_other + coalesce(new.reviewed_quantity, new.quantity) > v_budget then
    raise exception 'Položku nemožno prečerpať. Pred začiatkom portálu a v ostatných mesiacoch je už vykázané množstvo; dostupné je %.',
      v_budget - v_other;
  end if;
  return new;
end;
$$;

create or replace function sitedesk_private.subcontract_guard_submit_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_item_id uuid; v_budget numeric(18,3); v_used numeric(18,3);
begin
  if old.status <> 'draft' or new.status <> 'submitted' then return new; end if;
  for v_item_id in
    select distinct r.work_item_id from public.subcontract_statement_rows r
    where r.statement_id = new.id order by r.work_item_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_item_id::text, 0));
    select greatest(0, i.contract_qty - i.opening_qty) into v_budget
      from public.subcontract_work_items i where i.id = v_item_id for share;
    select coalesce(sum(coalesce(r.reviewed_quantity, r.quantity)), 0)
      into v_used from public.subcontract_statement_rows r
      where r.work_item_id = v_item_id;
    if v_used > v_budget then
      raise exception 'Súpis nemožno odoslať. Po odpočítaní starších prác zostáva %, v portáli je vykázaných %.',
        v_budget, v_used;
    end if;
  end loop;
  return new;
end;
$$;

grant insert (opening_qty, opening_amount, opening_before_period)
  on public.subcontract_work_items to authenticated;
grant update (opening_qty, opening_amount, opening_before_period)
  on public.subcontract_work_items to authenticated;

-- Bring forward the quantities already entered in the main BETPRES work
-- statements. Existing supplier quantities take precedence: never copy a
-- period that a supplier has actually started reporting in this portal.
-- This operator migration temporarily bypasses the browser owner guard;
-- the guard is restored in the same transaction after the backfill.
alter table public.subcontract_work_items disable trigger subcontract_work_item_guard;

with eligible_scopes as (
  select s.id, s.workspace_id, s.project_id, s.company_id
  from public.subcontract_scopes s
  where not exists (
    select 1 from public.subcontract_statements st
      join public.subcontract_statement_rows r on r.statement_id = st.id
    where st.scope_id = s.id and coalesce(r.reviewed_quantity, r.quantity) > 0
  )
), raw_history as (
  select s.id as scope_id, statement->>'period' as period,
    coalesce(nullif(item->>'budgetItemId', ''), nullif(item->>'id', '')) as source_item_id,
    replace(regexp_replace(coalesce(item->>'currentQty', ''), '[[:space:]]', '', 'g'), ',', '.') as quantity_text,
    replace(regexp_replace(coalesce(item->>'unitPrice', ''), '[[:space:]]', '', 'g'), ',', '.') as price_text
  from eligible_scopes s
    join public.sitedesk_workspaces w on w.id = s.workspace_id
    cross join lateral jsonb_array_elements(coalesce(w.data->'workStatements', '[]'::jsonb)) statement
    cross join lateral jsonb_array_elements(coalesce(statement->'items', '[]'::jsonb)) item
  where statement->>'projectId' = s.project_id
    and statement->>'companyId' = s.company_id
    and statement->>'period' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
), history as (
  select scope_id, period, source_item_id,
    case when quantity_text ~ '^-?[0-9]+([.][0-9]+)?$' then quantity_text::numeric else 0 end as quantity,
    case when price_text ~ '^-?[0-9]+([.][0-9]+)?$' then price_text::numeric else 0 end as price
  from raw_history
), cutoffs as (
  select scope_id,
    greatest(to_char(current_timestamp at time zone 'Europe/Bratislava', 'YYYY-MM'),
      coalesce(to_char(max(case when quantity > 0 then (period || '-01')::date end) + interval '1 month', 'YYYY-MM'),
        to_char(current_timestamp at time zone 'Europe/Bratislava', 'YYYY-MM'))) as first_period
  from history group by scope_id
), totals as (
  select h.scope_id, h.source_item_id,
    round(sum(h.quantity), 3) as quantity,
    round(sum(round(h.quantity * h.price, 2)), 2) as amount
  from history h join cutoffs c on c.scope_id = h.scope_id
  where h.period < c.first_period and h.source_item_id is not null
  group by h.scope_id, h.source_item_id
)
update public.subcontract_work_items i
  set opening_qty = coalesce((select t.quantity from totals t
      where t.scope_id = i.scope_id and t.source_item_id = i.source_item_id), 0),
    opening_amount = coalesce((select t.amount from totals t
      where t.scope_id = i.scope_id and t.source_item_id = i.source_item_id), 0),
    opening_before_period = c.first_period
from cutoffs c where i.scope_id = c.scope_id;

alter table public.subcontract_work_items enable trigger subcontract_work_item_guard;

select pg_catalog.pg_notify('pgrst', 'reload schema');
commit;
