-- Endereço disponível para um novo restaurante. Chamada sem sessão pelo fluxo de
-- contratação (billing e site público), por isso só devolve true ou false e não
-- expõe dados de tenants. Não é SECURITY INVOKER: anon não lê public.tenants.
create or replace function public.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower(trim(p_slug)) ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'
    and not exists (select 1 from private.reserved_slugs r where r.slug = lower(trim(p_slug)))
    and not exists (select 1 from public.tenants t where t.slug = lower(trim(p_slug))),
    false
  );
$$;

revoke execute on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated, service_role;
