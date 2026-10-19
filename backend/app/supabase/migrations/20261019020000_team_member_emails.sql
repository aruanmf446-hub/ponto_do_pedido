-- E-mails da equipe: leitura mínima, limitada ao próprio restaurante e à permissão de equipe.
create or replace function public.team_member_emails(p_tenant uuid)
returns table(user_id uuid, email text)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, u.email::text
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant
    and private.is_member(p_tenant)
    and private.evaluate_permission(auth.uid(), p_tenant, 'gestao.equipe.visualizar') = 'direct'
$$;
revoke all on function public.team_member_emails(uuid) from public, anon;
grant execute on function public.team_member_emails(uuid) to authenticated;
