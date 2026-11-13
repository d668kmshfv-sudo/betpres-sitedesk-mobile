-- Removing a supplier must also invalidate a newly prepared invitation for
-- that same e-mail. Otherwise the account could claim the scope again.
begin;

create function sitedesk_private.revoke_pending_supplier_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.subcontract_invitations i
  set status = 'revoked', revoked_at = now()
  where i.scope_id = old.scope_id
    and i.email = lower(trim(old.email))
    and i.status = 'pending';
  return old;
end;
$$;

create trigger subcontract_revoke_invite_on_member_removal
after delete on public.subcontract_scope_members
for each row execute function sitedesk_private.revoke_pending_supplier_invite();

revoke all on function sitedesk_private.revoke_pending_supplier_invite()
from public, anon, authenticated;

commit;
