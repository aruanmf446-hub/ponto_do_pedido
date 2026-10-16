-- Administrativo e Financeiro: fornecedores, compras (solicitação → cotação →
-- aprovação → pedido → recebimento), contas a pagar/receber, despesas,
-- documentos, orçamentos, reembolsos, fluxo de caixa e conciliação.
-- Cada processo respeita a responsabilidade definida (interno x ERP externo).

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  document text,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('contrato', 'nota_fiscal', 'comprovante', 'orcamento', 'outro')),
  title text not null,
  storage_path text,
  supplier_id uuid references public.suppliers (id) on delete set null,
  amount_cents bigint,
  issued_on date,
  valid_until date,
  related_entity text,
  related_id uuid,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index documents_tenant_kind_idx on public.documents (tenant_id, kind, created_at desc);
create index documents_supplier_idx on public.documents (supplier_id);

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number bigint not null,
  status text not null default 'requested'
    check (status in ('requested', 'quoting', 'approved', 'rejected', 'ordered', 'received', 'cancelled')),
  justification text not null,
  needed_by date,
  material_request_id uuid,
  requested_by uuid not null references auth.users (id),
  requested_at timestamptz not null default now(),
  approved_quotation_id uuid,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text,
  unique (tenant_id, number)
);
create index purchase_requests_tenant_status_idx on public.purchase_requests (tenant_id, status, requested_at desc);

create table public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  request_id uuid not null references public.purchase_requests (id) on delete cascade,
  material_id uuid references public.materials (id) on delete set null,
  description text not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null default 'un'
);
create index purchase_request_items_request_idx on public.purchase_request_items (request_id);
create index purchase_request_items_material_idx on public.purchase_request_items (material_id);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  request_id uuid not null references public.purchase_requests (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  total_cents bigint not null check (total_cents >= 0),
  delivery_days int,
  valid_until date,
  payment_terms text,
  notes text,
  document_id uuid references public.documents (id) on delete set null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index quotations_request_idx on public.quotations (request_id);
create index quotations_supplier_idx on public.quotations (supplier_id);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number bigint not null,
  request_id uuid references public.purchase_requests (id),
  quotation_id uuid references public.quotations (id),
  supplier_id uuid not null references public.suppliers (id),
  status text not null default 'issued' check (status in ('issued', 'partially_received', 'received', 'cancelled')),
  total_cents bigint not null check (total_cents >= 0),
  expected_on date,
  payment_due_days int not null default 0,
  issued_by uuid not null references auth.users (id),
  issued_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index purchase_orders_tenant_status_idx on public.purchase_orders (tenant_id, status);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index purchase_orders_request_idx on public.purchase_orders (request_id);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null references public.purchase_orders (id) on delete cascade,
  material_id uuid references public.materials (id) on delete set null,
  description text not null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null default 'un',
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  received_qty numeric(14, 3) not null default 0
);
create index purchase_order_items_order_idx on public.purchase_order_items (order_id);
create index purchase_order_items_material_idx on public.purchase_order_items (material_id);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null references public.purchase_orders (id),
  invoice_number text,
  invoice_document_id uuid references public.documents (id) on delete set null,
  notes text,
  received_by uuid not null references auth.users (id),
  received_at timestamptz not null default now(),
  idempotency_key text not null,
  unique (tenant_id, idempotency_key)
);
create index goods_receipts_order_idx on public.goods_receipts (order_id);

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null default 'conta' check (kind in ('conta', 'despesa', 'reembolso', 'compra')),
  supplier_id uuid references public.suppliers (id) on delete set null,
  purchase_order_id uuid references public.purchase_orders (id),
  description text not null,
  category text not null default 'Geral',
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  document_id uuid references public.documents (id) on delete set null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid references auth.users (id),
  paid_method text,
  proof_document_id uuid references public.documents (id) on delete set null,
  idempotency_key text,
  unique (tenant_id, idempotency_key)
);
create index payables_tenant_status_due_idx on public.payables (tenant_id, status, due_date);
create index payables_supplier_idx on public.payables (supplier_id);
create index payables_po_idx on public.payables (purchase_order_id);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_name text not null,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'received', 'cancelled')),
  received_at timestamptz,
  received_by uuid references auth.users (id),
  received_note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index receivables_tenant_status_due_idx on public.receivables (tenant_id, status, due_date);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category text not null,
  month date not null check (extract(day from month) = 1),
  limit_cents bigint not null check (limit_cents >= 0),
  unique (tenant_id, category, month)
);

create table public.reimbursements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  requested_by uuid not null references auth.users (id),
  description text not null,
  category text not null default 'Geral',
  amount_cents bigint not null check (amount_cents > 0),
  spent_on date not null,
  document_id uuid references public.documents (id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'paid')),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text,
  payable_id uuid references public.payables (id),
  created_at timestamptz not null default now()
);
create index reimbursements_tenant_status_idx on public.reimbursements (tenant_id, status);

-- Lançamentos financeiros manuais e conciliação bancária (sem integração).
create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  description text not null,
  source text not null check (source in ('payable', 'receivable', 'manual', 'caixa')),
  source_id uuid,
  reconciled boolean not null default false,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users (id),
  bank_reference text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index financial_entries_tenant_date_idx on public.financial_entries (tenant_id, occurred_on desc);
create unique index financial_entries_source_uq on public.financial_entries (tenant_id, source, source_id) where source_id is not null;

alter table public.suppliers enable row level security;
alter table public.documents enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.quotations enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.payables enable row level security;
alter table public.receivables enable row level security;
alter table public.budgets enable row level security;
alter table public.reimbursements enable row level security;
alter table public.financial_entries enable row level security;

-- Dados financeiros: titular ou quem acessa o Administrativo/Financeiro.
create or replace function private.can_view_finance(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_owner(p_tenant)
    or private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.acessar') = 'direct'
$$;
grant execute on function private.can_view_finance(uuid) to authenticated;

create policy suppliers_select on public.suppliers for select to authenticated using ((select private.is_member(tenant_id)));
create policy documents_select on public.documents for select to authenticated using ((select private.can_view_finance(tenant_id)));
create policy purchase_requests_select on public.purchase_requests for select to authenticated
  using ((select private.can_view_finance(tenant_id)) or requested_by = (select auth.uid()));
create policy purchase_request_items_select on public.purchase_request_items for select to authenticated
  using ((select private.can_view_finance(tenant_id))
    or exists (select 1 from public.purchase_requests r where r.id = request_id and r.requested_by = (select auth.uid())));
create policy quotations_select on public.quotations for select to authenticated using ((select private.can_view_finance(tenant_id)));
create policy purchase_orders_select on public.purchase_orders for select to authenticated
  using ((select private.can_view_finance(tenant_id))
    or private.evaluate_permission((select auth.uid()), tenant_id, 'estoque.entrada.registrar') = 'direct');
create policy purchase_order_items_select on public.purchase_order_items for select to authenticated
  using ((select private.can_view_finance(tenant_id))
    or private.evaluate_permission((select auth.uid()), tenant_id, 'estoque.entrada.registrar') = 'direct');
create policy goods_receipts_select on public.goods_receipts for select to authenticated
  using ((select private.can_view_finance(tenant_id))
    or private.evaluate_permission((select auth.uid()), tenant_id, 'estoque.entrada.registrar') = 'direct');
create policy payables_select on public.payables for select to authenticated using ((select private.can_view_finance(tenant_id)));
create policy receivables_select on public.receivables for select to authenticated using ((select private.can_view_finance(tenant_id)));
create policy budgets_select on public.budgets for select to authenticated using ((select private.can_view_finance(tenant_id)));
create policy reimbursements_select on public.reimbursements for select to authenticated
  using ((select private.can_view_finance(tenant_id)) or requested_by = (select auth.uid()));
create policy financial_entries_select on public.financial_entries for select to authenticated using ((select private.can_view_finance(tenant_id)));

create or replace function private.require_internal(p_tenant uuid, p_process text, p_label text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.process_internal(p_tenant, p_process) then
    perform private.fail('PROCESS_EXTERNAL', p_label || ' é controlado em sistema externo por este estabelecimento.');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fornecedores e documentos
-- ---------------------------------------------------------------------------
create or replace function public.supplier_save(
  p_tenant uuid, p_id uuid, p_name text, p_document text, p_contact_name text, p_phone text, p_email text, p_notes text, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id;
begin
  perform private.authorize(p_tenant, 'financeiro.fornecedores.gerir');
  perform private.require_internal(p_tenant, 'fornecedores', 'O cadastro de fornecedores');
  if v_id is null then
    insert into public.suppliers (tenant_id, name, document, contact_name, phone, email, notes, active)
      values (p_tenant, trim(p_name), p_document, p_contact_name, p_phone, p_email, p_notes, coalesce(p_active, true))
      returning id into v_id;
  else
    update public.suppliers set name = trim(p_name), document = p_document, contact_name = p_contact_name, phone = p_phone,
      email = p_email, notes = p_notes, active = coalesce(p_active, active)
      where id = v_id and tenant_id = p_tenant;
    if not found then perform private.fail('NOT_FOUND', 'Fornecedor não encontrado.'); end if;
  end if;
  perform private.audit(p_tenant, 'financeiro', 'supplier.saved', 'supplier', v_id::text, jsonb_build_object('name', p_name));
  return v_id;
end $$;

create or replace function public.document_save(
  p_tenant uuid, p_kind text, p_title text, p_storage_path text, p_supplier uuid, p_amount_cents bigint,
  p_issued_on date, p_valid_until date, p_related_entity text, p_related_id uuid, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  -- Documentos em geral: Administrativo (processo interno). Comprovantes também
  -- podem ser anexados por quem registra contas ou solicita reembolso.
  if private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.documentos.gerir') = 'direct' then
    perform private.authorize(p_tenant, 'financeiro.documentos.gerir');
    if p_kind <> 'comprovante' then
      perform private.require_internal(p_tenant, 'documentos', 'A gestão de documentos');
    end if;
  else
    if p_kind <> 'comprovante' then
      perform private.fail('FORBIDDEN', 'Você pode anexar apenas comprovantes.');
    end if;
    if private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.pagar.gerir') = 'direct' then
      perform private.authorize(p_tenant, 'financeiro.pagar.gerir');
    else
      perform private.authorize(p_tenant, 'financeiro.reembolsos.solicitar');
    end if;
  end if;
  if p_storage_path is not null and split_part(p_storage_path, '/', 1) <> p_tenant::text then
    perform private.fail('INVALID', 'Arquivo inválido para este estabelecimento.');
  end if;
  insert into public.documents (tenant_id, kind, title, storage_path, supplier_id, amount_cents, issued_on, valid_until,
    related_entity, related_id, notes, created_by)
  values (p_tenant, p_kind, trim(p_title), p_storage_path, p_supplier, p_amount_cents, p_issued_on, p_valid_until,
    p_related_entity, p_related_id, p_notes, (select auth.uid()))
  returning id into v_id;
  perform private.audit(p_tenant, 'financeiro', 'document.saved', 'document', v_id::text, jsonb_build_object('kind', p_kind, 'title', p_title));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Compras
-- ---------------------------------------------------------------------------
create or replace function public.purchase_request_create(
  p_tenant uuid, p_justification text, p_needed_by date, p_items jsonb, p_material_request uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_item jsonb;
begin
  -- Estoque também pode solicitar compra quando não há disponibilidade
  if private.evaluate_permission((select auth.uid()), p_tenant, 'financeiro.compras.solicitar') = 'direct' then
    perform private.authorize(p_tenant, 'financeiro.compras.solicitar');
  else
    perform private.authorize(p_tenant, 'estoque.solicitacao.atender');
  end if;
  perform private.require_internal(p_tenant, 'compras', 'O processo de compras');
  if coalesce(trim(p_justification), '') = '' then perform private.fail('INVALID', 'Informe a justificativa.'); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform private.fail('INVALID', 'Inclua ao menos um item.');
  end if;
  insert into public.purchase_requests (tenant_id, number, justification, needed_by, material_request_id, requested_by)
    values (p_tenant, private.next_number(p_tenant, 'purchase_request'), trim(p_justification), p_needed_by, p_material_request, (select auth.uid()))
    returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.purchase_request_items (tenant_id, request_id, material_id, description, quantity, unit)
    select p_tenant, v_id, m.id, coalesce(nullif(trim(v_item ->> 'description'), ''), m.name),
      (v_item ->> 'quantity')::numeric, coalesce(v_item ->> 'unit', m.unit, 'un')
    from (select 1) one left join public.materials m on m.id = nullif(v_item ->> 'material_id', '')::uuid and m.tenant_id = p_tenant;
  end loop;
  perform private.audit(p_tenant, 'financeiro', 'purchase.requested', 'purchase_request', v_id::text, jsonb_build_object('items', p_items));
  return v_id;
end $$;

create or replace function public.quotation_add(
  p_tenant uuid, p_request uuid, p_supplier uuid, p_total_cents bigint, p_delivery_days int,
  p_valid_until date, p_payment_terms text, p_notes text, p_document uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_req public.purchase_requests;
  v_id uuid;
begin
  perform private.authorize(p_tenant, 'financeiro.compras.cotar');
  select * into v_req from public.purchase_requests where id = p_request and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Solicitação não encontrada.'); end if;
  if v_req.status not in ('requested', 'quoting') then
    perform private.fail('INVALID_STATE', 'A solicitação não aceita novas cotações.');
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier and tenant_id = p_tenant and active) then
    perform private.fail('INVALID', 'Fornecedor inválido.');
  end if;
  insert into public.quotations (tenant_id, request_id, supplier_id, total_cents, delivery_days, valid_until, payment_terms, notes, document_id, created_by)
    values (p_tenant, p_request, p_supplier, p_total_cents, p_delivery_days, p_valid_until, p_payment_terms, p_notes, p_document, (select auth.uid()))
    returning id into v_id;
  update public.purchase_requests set status = 'quoting' where id = p_request;
  perform private.audit(p_tenant, 'financeiro', 'purchase.quoted', 'quotation', v_id::text,
    jsonb_build_object('request', v_req.number, 'total_cents', p_total_cents));
  return v_id;
end $$;

-- Aprovação (escolhe a cotação) ou recusa da compra. O valor é o da cotação.
create or replace function public.purchase_decide(p_tenant uuid, p_request uuid, p_quotation uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req public.purchase_requests;
  v_quote public.quotations;
  v_approval uuid;
begin
  select * into v_req from public.purchase_requests where id = p_request and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Solicitação não encontrada.'); end if;
  if p_approve then
    select * into v_quote from public.quotations where id = p_quotation and request_id = p_request;
    if not found then perform private.fail('INVALID', 'Selecione uma cotação.'); end if;
    v_approval := private.authorize(p_tenant, 'financeiro.compras.aprovar', v_quote.total_cents);
  else
    v_approval := private.authorize(p_tenant, 'financeiro.compras.aprovar');
  end if;
  select * into v_req from public.purchase_requests where id = p_request for update;
  if v_req.status not in ('requested', 'quoting') then
    perform private.fail('INVALID_STATE', 'A solicitação já foi decidida.');
  end if;
  if v_req.requested_by = (select auth.uid()) and not private.is_owner(p_tenant) then
    perform private.fail('SELF_APPROVAL', 'Quem solicita não aprova a própria compra.');
  end if;
  update public.purchase_requests set status = case when p_approve then 'approved' else 'rejected' end,
    approved_quotation_id = case when p_approve then p_quotation end,
    decided_by = (select auth.uid()), decided_at = now(), decision_note = p_note
    where id = p_request;
  perform private.audit(p_tenant, 'financeiro', case when p_approve then 'purchase.approved' else 'purchase.rejected' end,
    'purchase_request', p_request::text, jsonb_build_object('quotation', p_quotation, 'total_cents', v_quote.total_cents, 'note', p_note), v_approval);
end $$;

-- Emite o pedido de compra ao fornecedor a partir da cotação aprovada.
create or replace function public.purchase_order_issue(
  p_tenant uuid, p_request uuid, p_expected_on date, p_payment_due_days int, p_items jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_req public.purchase_requests;
  v_quote public.quotations;
  v_id uuid;
  v_item jsonb;
  v_sum bigint;
begin
  perform private.authorize(p_tenant, 'financeiro.compras.comprar');
  select * into v_req from public.purchase_requests where id = p_request and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Solicitação não encontrada.'); end if;
  if v_req.status <> 'approved' then
    perform private.fail('INVALID_STATE', 'A compra precisa estar aprovada.');
  end if;
  select * into v_quote from public.quotations where id = v_req.approved_quotation_id;
  insert into public.purchase_orders (tenant_id, number, request_id, quotation_id, supplier_id, total_cents, expected_on, payment_due_days, issued_by)
    values (p_tenant, private.next_number(p_tenant, 'purchase_order'), p_request, v_quote.id, v_quote.supplier_id,
      v_quote.total_cents, p_expected_on, coalesce(p_payment_due_days, 0), (select auth.uid()))
    returning id into v_id;
  if p_items is not null and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      insert into public.purchase_order_items (tenant_id, order_id, material_id, description, quantity, unit, unit_price_cents)
      values (p_tenant, v_id, nullif(v_item ->> 'material_id', '')::uuid, v_item ->> 'description',
        (v_item ->> 'quantity')::numeric, coalesce(v_item ->> 'unit', 'un'), coalesce((v_item ->> 'unit_price_cents')::bigint, 0));
    end loop;
  else
    insert into public.purchase_order_items (tenant_id, order_id, material_id, description, quantity, unit, unit_price_cents)
      select p_tenant, v_id, i.material_id, i.description, i.quantity, i.unit, 0
      from public.purchase_request_items i where i.request_id = p_request;
  end if;
  select coalesce(sum(round(quantity * unit_price_cents)), 0) into v_sum from public.purchase_order_items where order_id = v_id;
  if v_sum > v_quote.total_cents then
    perform private.fail('INVALID', 'Os itens somam mais que a cotação aprovada.');
  end if;
  update public.purchase_requests set status = 'ordered' where id = p_request;
  perform private.audit(p_tenant, 'financeiro', 'purchase.ordered', 'purchase_order', v_id::text,
    jsonb_build_object('request', v_req.number, 'total_cents', v_quote.total_cents));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Contas a pagar, despesas, contas a receber
-- ---------------------------------------------------------------------------
create or replace function public.payable_create(
  p_tenant uuid, p_kind text, p_supplier uuid, p_description text, p_category text, p_amount_cents bigint,
  p_due_date date, p_document uuid, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.authorize(p_tenant, 'financeiro.pagar.gerir');
  perform private.require_internal(p_tenant, 'contas_pagar', 'Contas a pagar');
  select id into v_id from public.payables where tenant_id = p_tenant and idempotency_key = p_idempotency_key;
  if found then return v_id; end if;
  insert into public.payables (tenant_id, kind, supplier_id, description, category, amount_cents, due_date, document_id, created_by, idempotency_key)
    values (p_tenant, coalesce(p_kind, 'conta'), p_supplier, trim(p_description), coalesce(nullif(trim(p_category), ''), 'Geral'),
      p_amount_cents, p_due_date, p_document, (select auth.uid()), p_idempotency_key)
    returning id into v_id;
  perform private.audit(p_tenant, 'financeiro', 'payable.created', 'payable', v_id::text,
    jsonb_build_object('amount_cents', p_amount_cents, 'due_date', p_due_date, 'description', p_description));
  return v_id;
end $$;

create or replace function public.payable_pay(
  p_tenant uuid, p_payable uuid, p_paid_method text, p_proof_document uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_payable public.payables;
  v_approval uuid;
begin
  select * into v_payable from public.payables where id = p_payable and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Conta não encontrada.'); end if;
  v_approval := private.authorize(p_tenant, 'financeiro.pagar.pagar', v_payable.amount_cents);
  perform private.require_internal(p_tenant, 'contas_pagar', 'Contas a pagar');
  select * into v_payable from public.payables where id = p_payable for update;
  if v_payable.status = 'paid' then return; end if;
  if v_payable.status <> 'open' then perform private.fail('INVALID_STATE', 'A conta não está em aberto.'); end if;
  update public.payables set status = 'paid', paid_at = now(), paid_by = (select auth.uid()),
    paid_method = p_paid_method, proof_document_id = p_proof_document where id = p_payable;
  insert into public.financial_entries (tenant_id, direction, amount_cents, occurred_on, description, source, source_id, created_by)
    values (p_tenant, 'out', v_payable.amount_cents, (now() at time zone coalesce((select t.timezone from public.tenants t where t.id = p_tenant), 'America/Sao_Paulo'))::date, v_payable.description, 'payable', p_payable, (select auth.uid()))
    on conflict do nothing;
  if v_payable.kind = 'reembolso' then
    update public.reimbursements set status = 'paid' where payable_id = p_payable;
  end if;
  perform private.audit(p_tenant, 'financeiro', 'payable.paid', 'payable', p_payable::text,
    jsonb_build_object('amount_cents', v_payable.amount_cents, 'method', p_paid_method), v_approval);
end $$;

create or replace function public.payable_cancel(p_tenant uuid, p_payable uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.authorize(p_tenant, 'financeiro.pagar.gerir');
  update public.payables set status = 'cancelled' where id = p_payable and tenant_id = p_tenant and status = 'open';
  if not found then perform private.fail('INVALID_STATE', 'Somente contas em aberto podem ser canceladas.'); end if;
  perform private.audit(p_tenant, 'financeiro', 'payable.cancelled', 'payable', p_payable::text, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.receivable_save(
  p_tenant uuid, p_customer text, p_description text, p_amount_cents bigint, p_due_date date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.authorize(p_tenant, 'financeiro.receber.gerir');
  perform private.require_internal(p_tenant, 'contas_receber', 'Contas a receber');
  insert into public.receivables (tenant_id, customer_name, description, amount_cents, due_date, created_by)
    values (p_tenant, trim(p_customer), trim(p_description), p_amount_cents, p_due_date, (select auth.uid()))
    returning id into v_id;
  perform private.audit(p_tenant, 'financeiro', 'receivable.created', 'receivable', v_id::text, jsonb_build_object('amount_cents', p_amount_cents));
  return v_id;
end $$;

create or replace function public.receivable_settle(p_tenant uuid, p_receivable uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_rec public.receivables;
begin
  perform private.authorize(p_tenant, 'financeiro.receber.gerir');
  select * into v_rec from public.receivables where id = p_receivable and tenant_id = p_tenant for update;
  if not found then perform private.fail('NOT_FOUND', 'Recebível não encontrado.'); end if;
  if v_rec.status = 'received' then return; end if;
  if v_rec.status <> 'open' then perform private.fail('INVALID_STATE', 'Recebível não está em aberto.'); end if;
  update public.receivables set status = 'received', received_at = now(), received_by = (select auth.uid()), received_note = p_note
    where id = p_receivable;
  insert into public.financial_entries (tenant_id, direction, amount_cents, occurred_on, description, source, source_id, created_by)
    values (p_tenant, 'in', v_rec.amount_cents, (now() at time zone coalesce((select t.timezone from public.tenants t where t.id = p_tenant), 'America/Sao_Paulo'))::date, v_rec.description, 'receivable', p_receivable, (select auth.uid()))
    on conflict do nothing;
  perform private.audit(p_tenant, 'financeiro', 'receivable.settled', 'receivable', p_receivable::text, jsonb_build_object('amount_cents', v_rec.amount_cents));
end $$;

-- ---------------------------------------------------------------------------
-- Orçamentos, reembolsos, conciliação
-- ---------------------------------------------------------------------------
create or replace function public.budget_set(p_tenant uuid, p_category text, p_month date, p_limit_cents bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_approval uuid;
begin
  v_approval := private.authorize(p_tenant, 'financeiro.orcamentos.gerir');
  perform private.require_internal(p_tenant, 'orcamentos', 'Orçamentos');
  insert into public.budgets (tenant_id, category, month, limit_cents)
    values (p_tenant, trim(p_category), date_trunc('month', p_month)::date, p_limit_cents)
    on conflict (tenant_id, category, month) do update set limit_cents = excluded.limit_cents;
  perform private.audit(p_tenant, 'financeiro', 'budget.set', 'budget', p_category,
    jsonb_build_object('month', p_month, 'limit_cents', p_limit_cents), v_approval);
end $$;

create or replace function public.reimbursement_request(
  p_tenant uuid, p_description text, p_category text, p_amount_cents bigint, p_spent_on date, p_document uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.authorize(p_tenant, 'financeiro.reembolsos.solicitar');
  perform private.require_internal(p_tenant, 'reembolsos', 'Reembolsos');
  insert into public.reimbursements (tenant_id, requested_by, description, category, amount_cents, spent_on, document_id)
    values (p_tenant, (select auth.uid()), trim(p_description), coalesce(nullif(trim(p_category), ''), 'Geral'), p_amount_cents, p_spent_on, p_document)
    returning id into v_id;
  perform private.audit(p_tenant, 'financeiro', 'reimbursement.requested', 'reimbursement', v_id::text, jsonb_build_object('amount_cents', p_amount_cents));
  return v_id;
end $$;

create or replace function public.reimbursement_decide(p_tenant uuid, p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_r public.reimbursements;
  v_payable uuid;
  v_approval uuid;
begin
  select * into v_r from public.reimbursements where id = p_id and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Reembolso não encontrado.'); end if;
  v_approval := private.authorize(p_tenant, 'financeiro.reembolsos.aprovar', v_r.amount_cents);
  select * into v_r from public.reimbursements where id = p_id for update;
  if v_r.status <> 'requested' then perform private.fail('INVALID_STATE', 'Reembolso já decidido.'); end if;
  if v_r.requested_by = (select auth.uid()) and not private.is_owner(p_tenant) then
    perform private.fail('SELF_APPROVAL', 'Quem solicita não aprova o próprio reembolso.');
  end if;
  if p_approve and private.process_internal(p_tenant, 'contas_pagar') then
    insert into public.payables (tenant_id, kind, description, category, amount_cents, due_date, document_id, created_by)
      values (p_tenant, 'reembolso', 'Reembolso: ' || v_r.description, v_r.category, v_r.amount_cents, (now() at time zone coalesce((select t.timezone from public.tenants t where t.id = p_tenant), 'America/Sao_Paulo'))::date + 7, v_r.document_id, (select auth.uid()))
      returning id into v_payable;
  end if;
  update public.reimbursements set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = (select auth.uid()), decided_at = now(), decision_note = p_note, payable_id = v_payable
    where id = p_id;
  perform private.audit(p_tenant, 'financeiro', case when p_approve then 'reimbursement.approved' else 'reimbursement.rejected' end,
    'reimbursement', p_id::text, jsonb_build_object('amount_cents', v_r.amount_cents, 'note', p_note), v_approval);
end $$;

create or replace function public.financial_entry_manual(
  p_tenant uuid, p_direction text, p_amount_cents bigint, p_occurred_on date, p_description text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.authorize(p_tenant, 'financeiro.conciliacao.executar');
  insert into public.financial_entries (tenant_id, direction, amount_cents, occurred_on, description, source, created_by)
    values (p_tenant, p_direction, p_amount_cents, p_occurred_on, trim(p_description), 'manual', (select auth.uid()))
    returning id into v_id;
  perform private.audit(p_tenant, 'financeiro', 'entry.manual', 'financial_entry', v_id::text,
    jsonb_build_object('direction', p_direction, 'amount_cents', p_amount_cents));
  return v_id;
end $$;

create or replace function public.financial_reconcile(p_tenant uuid, p_entry uuid, p_bank_reference text, p_reconciled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.authorize(p_tenant, 'financeiro.conciliacao.executar');
  perform private.require_internal(p_tenant, 'conciliacao', 'A conciliação');
  update public.financial_entries set reconciled = p_reconciled,
    reconciled_at = case when p_reconciled then now() end,
    reconciled_by = case when p_reconciled then (select auth.uid()) end,
    bank_reference = case when p_reconciled then p_bank_reference end
    where id = p_entry and tenant_id = p_tenant;
  if not found then perform private.fail('NOT_FOUND', 'Lançamento não encontrado.'); end if;
  perform private.audit(p_tenant, 'financeiro', 'entry.reconciled', 'financial_entry', p_entry::text,
    jsonb_build_object('reconciled', p_reconciled, 'bank_reference', p_bank_reference));
end $$;

-- Fluxo de caixa por dia: recebimentos do Caixa (por dia operacional) +
-- lançamentos financeiros (contas, recebíveis e manuais).
create or replace function public.cash_flow(p_tenant uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_view_finance(p_tenant) then
    perform private.fail('FORBIDDEN', 'Você não tem acesso ao financeiro.');
  end if;
  return (
    with days as (
      select d::date as day from generate_series(p_from, p_to, interval '1 day') d
    ), sales as (
      select business_day as day, sum(amount_cents) as v from public.payments
      where tenant_id = p_tenant and status = 'confirmed' and business_day between p_from and p_to
      group by business_day
    ), entries as (
      select occurred_on as day,
        sum(case when direction = 'in' then amount_cents else 0 end) as vin,
        sum(case when direction = 'out' then amount_cents else 0 end) as vout
      from public.financial_entries where tenant_id = p_tenant and occurred_on between p_from and p_to
      group by occurred_on
    ), scheduled as (
      select due_date as day, sum(amount_cents) as v from public.payables
      where tenant_id = p_tenant and status = 'open' and due_date between p_from and p_to group by due_date
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', days.day,
      'sales_cents', coalesce(s.v, 0),
      'in_cents', coalesce(e.vin, 0),
      'out_cents', coalesce(e.vout, 0),
      'scheduled_out_cents', coalesce(sc.v, 0),
      'net_cents', coalesce(s.v, 0) + coalesce(e.vin, 0) - coalesce(e.vout, 0)
    ) order by days.day), '[]'::jsonb)
    from days left join sales s on s.day = days.day left join entries e on e.day = days.day
    left join scheduled sc on sc.day = days.day
  );
end $$;
