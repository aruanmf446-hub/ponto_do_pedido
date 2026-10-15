import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, as, createTenant, createUser, errorCode, pool, q, service, val } from './helpers';

afterAll(() => pool.end());

// Documentos: Administrativo arquiva qualquer tipo (processo interno);
// quem só registra contas ou pede reembolso anexa apenas comprovantes.
describe('documentos', () => {
  let owner: string;
  let tenant: string;
  let adm: string;
  let caixa: string;

  beforeAll(async () => {
    owner = await createUser('Titular Docs');
    tenant = (await createTenant(owner)).tenantId;
    adm = await addMember(tenant, owner, 'Administrativo', ['Administrativo'], 'financeiro');
    caixa = await addMember(tenant, owner, 'Operador de caixa', ['Caixa'], 'caixa');
    const membership = await val<string>(service, 'select id from public.memberships where tenant_id = $1 and user_id = $2', [tenant, caixa]);
    await q(as(owner), `select public.member_grant($1, $2, 'financeiro.reembolsos.solicitar', 'direct', null, false, null)`, [tenant, membership]);
  });

  it('administrativo arquiva contratos; caixa só anexa comprovantes', async () => {
    await q(as(adm), `select public.document_save($1, 'contrato', 'Contrato aluguel', null, null, null, null, null, null, null, null)`, [tenant]);
    expect(
      await errorCode(() => q(as(caixa), `select public.document_save($1, 'contrato', 'Contrato falso', null, null, null, null, null, null, null, null)`, [tenant])),
    ).toBe('FORBIDDEN');
    const doc = await val<string>(as(caixa), `select public.document_save($1, 'comprovante', 'Recibo táxi', null, null, 2500, null, null, null, null, null)`, [tenant]);
    expect(doc).toMatch(/[0-9a-f-]{36}/);
  });

  it('arquivo precisa estar na pasta do próprio estabelecimento', async () => {
    expect(
      await errorCode(() =>
        q(as(adm), `select public.document_save($1, 'nota_fiscal', 'NF', '00000000-0000-0000-0000-000000000000/x.pdf', null, null, null, null, null, null, null)`, [tenant]),
      ),
    ).toBe('INVALID');
  });

  it('com documentos no ERP externo, só comprovantes são aceitos', async () => {
    await q(as(owner), `select public.process_ownership_set($1, 'documentos', 'externo', 'ERP X')`, [tenant]);
    expect(
      await errorCode(() => q(as(adm), `select public.document_save($1, 'contrato', 'Contrato 2', null, null, null, null, null, null, null, null)`, [tenant])),
    ).toBe('PROCESS_EXTERNAL');
    await q(as(adm), `select public.document_save($1, 'comprovante', 'Comprovante PIX', null, null, 1000, null, null, null, null, null)`, [tenant]);
  });

  it('documentos não vazam para outro estabelecimento', async () => {
    const other = await createUser('Outro titular');
    await createTenant(other);
    const rows = await q(as(other), 'select id from public.documents where tenant_id = $1', [tenant]);
    expect(rows).toHaveLength(0);
  });
});
