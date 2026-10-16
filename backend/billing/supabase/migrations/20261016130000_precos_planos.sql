-- Preços mensais definidos pelo titular em 16/10/2026.
-- São valores em CENTAVOS; não cria plano nem altera assinatura existente.
-- START: R$ 49,99 | PLUS: R$ 80,00 | DIAMOND: R$ 150,00.
do $$
begin
  if (select count(*) from public.plans where code in ('start', 'plus', 'diamond')) <> 3 then
    raise exception 'Catálogo incompleto: START, PLUS e DIAMOND são obrigatórios';
  end if;
  if exists (select 1 from public.plans where code in ('start','plus','diamond') and billing_period <> 'monthly') then
    raise exception 'Período dos planos diverge do catálogo mensal';
  end if;

  update public.plans
     set price_cents = case code
       when 'start' then 4999
       when 'plus' then 8000
       when 'diamond' then 15000
       end
   where code in ('start', 'plus', 'diamond');
end;
$$;
