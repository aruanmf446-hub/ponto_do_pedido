-- Storage (logos, fotos de produtos, documentos) e Realtime.
-- Caminhos sempre começam pelo id do estabelecimento: {tenant_id}/...

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tenant-media', 'tenant-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('tenant-documents', 'tenant-documents', false, 15728640, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/xml', 'text/xml'])
on conflict (id) do nothing;

create or replace function private.storage_tenant(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end $$;
grant execute on function private.storage_tenant(text) to authenticated;

create or replace function private.can_manage_media(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_tenant is not null and (
    private.is_owner(p_tenant)
    or private.evaluate_permission((select auth.uid()), p_tenant, 'cadastros.produtos.alterar') = 'direct'
    or private.evaluate_permission((select auth.uid()), p_tenant, 'cadastros.produtos.cadastrar') = 'direct'
    or private.evaluate_permission((select auth.uid()), p_tenant, 'gestao.restaurante.alterar') = 'direct')
$$;
grant execute on function private.can_manage_media(uuid) to authenticated;

create or replace function private.can_manage_documents(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_tenant is not null and (
    private.is_owner(p_tenant)
    or private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.documentos.gerir') = 'direct'
    or private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.pagar.gerir') = 'direct'
    or private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.reembolsos.solicitar') = 'direct')
$$;
grant execute on function private.can_manage_documents(uuid) to authenticated;

create policy tenant_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (select private.can_manage_media(private.storage_tenant(name))));
create policy tenant_media_update on storage.objects for update to authenticated
  using (bucket_id = 'tenant-media' and (select private.can_manage_media(private.storage_tenant(name))))
  with check (bucket_id = 'tenant-media' and (select private.can_manage_media(private.storage_tenant(name))));
create policy tenant_media_select on storage.objects for select to authenticated
  using (bucket_id = 'tenant-media' and (select private.can_manage_media(private.storage_tenant(name))));
create policy tenant_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-media' and (select private.can_manage_media(private.storage_tenant(name))));

create policy tenant_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-documents' and (select private.can_manage_documents(private.storage_tenant(name))));
create policy tenant_documents_select on storage.objects for select to authenticated
  using (bucket_id = 'tenant-documents' and (
    (select private.can_manage_documents(private.storage_tenant(name)))
    or (select private.can_view_finance(private.storage_tenant(name)))));

-- Realtime: alterações operacionais chegam aos aplicativos (respeitando RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.tabs, public.orders, public.order_items, public.delivery_orders,
      public.approval_requests, public.material_requests, public.cash_sessions;
  end if;
end $$;
