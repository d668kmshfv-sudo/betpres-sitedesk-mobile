-- Temporarily give subcontractors access only to their own monthly statements.
-- Existing diary, crew and attachment records remain available to the main contractor.
begin;

alter policy subcontract_diary_read on public.subcontract_diary_days
  using (sitedesk_private.subcontract_main(scope_id));
alter policy subcontract_diary_create on public.subcontract_diary_days
  with check (created_by = (select auth.uid()) and sitedesk_private.subcontract_main(scope_id));
alter policy subcontract_diary_update on public.subcontract_diary_days
  using (status = 'draft' and sitedesk_private.subcontract_main(scope_id))
  with check (sitedesk_private.subcontract_main(scope_id));

alter policy subcontract_crew_read on public.subcontract_daily_crew
  using (sitedesk_private.subcontract_main(scope_id));
alter policy subcontract_crew_create on public.subcontract_daily_crew
  with check (created_by = (select auth.uid()) and sitedesk_private.subcontract_main(scope_id));
alter policy subcontract_crew_update on public.subcontract_daily_crew
  using (sitedesk_private.subcontract_main(scope_id))
  with check (sitedesk_private.subcontract_main(scope_id));

alter policy subcontract_notes_read on public.subcontract_owner_notes
  using (sitedesk_private.subcontract_main(scope_id));
alter policy subcontract_audit_read on public.subcontract_audit
  using (sitedesk_private.subcontract_main(scope_id));
alter policy subcontract_attachments_read on public.subcontract_attachments
  using (sitedesk_private.subcontract_main(scope_id));
alter policy subcontract_attachments_create on public.subcontract_attachments
  with check (created_by = (select auth.uid()) and sitedesk_private.subcontract_main(scope_id));

create or replace function sitedesk_private.subcontract_storage_upload(p_path text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  v_parts text[];
  v_scope_id uuid;
  v_day date;
begin
  v_parts := sitedesk_private.subcontract_path_parts(p_path);
  if v_parts is null then return false; end if;
  v_scope_id := v_parts[1]::uuid;
  if not sitedesk_private.subcontract_main(v_scope_id) then return false; end if;
  select d.day into v_day from public.subcontract_diary_days d
  where d.id = v_parts[2]::uuid and d.scope_id = v_scope_id;
  if not found then return false; end if;
  perform sitedesk_private.subcontract_lock_open_day(v_scope_id, v_day);
  return true;
end;
$$;

create or replace function sitedesk_private.subcontract_storage_read(p_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_parts text[]; v_scope_id uuid;
begin
  v_parts := sitedesk_private.subcontract_path_parts(p_path);
  if v_parts is null then return false; end if;
  v_scope_id := v_parts[1]::uuid;
  return sitedesk_private.subcontract_main(v_scope_id)
    and exists (
      select 1 from public.subcontract_attachments a
      where a.path = p_path and a.scope_id = v_scope_id
        and a.diary_day_id = v_parts[2]::uuid and a.id = v_parts[3]::uuid
    );
end;
$$;

commit;
