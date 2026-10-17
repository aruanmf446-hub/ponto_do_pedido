import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { noHorizontalOverflow } from './helpers';

// Não gerar links de recuperação nem usar credenciais de serviço em produção.
// Tokens locais não são registrados em traces/screenshots ou relatórios.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const local = ['localhost', '127.0.0.1'].includes(new URL(process.env.PDP_E2E_BASE_URL ?? 'http://localhost:3000').hostname);
for (const width of [390, 1440]) {
  test(`recuperação completa e e-mail pendente no Auth local em ${width}px`, async ({ page }) => {
    test.skip(!local, 'Fluxo de integração com fixture exclusivamente local.');
    const status = JSON.parse(
      execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
        cwd: 'backend/app',
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    const appUrl = process.env.PDP_APP_SUPABASE_URL ?? 'http://127.0.0.1:54321';
    if (!['localhost', '127.0.0.1'].includes(new URL(appUrl).hostname)) throw Error('Auth de teste deve ser local.');
    const admin = createClient(appUrl, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `security-${randomUUID()}@teste.local`;
    const newEmail = `security-${randomUUID()}@teste.local`;
    const oldPassword = `Old-${randomUUID()}`;
    const password = `New-${randomUUID()}`;
    const created = await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true });
    if (created.error || !created.data.user) throw Error('Não foi possível criar a fixture local.');
    const id = created.data.user.id;
    try {
      await page.setViewportSize({ width, height: 950 });
      await page.goto('/cadastro');
      await page.locator('input[name=name]').fill('Teste local');
      await page.locator('input[name=email]').fill(email);
      await page.locator('input[name=password]').fill(oldPassword);
      await page.locator('button[type=submit]').click();
      await expect(page.getByRole('heading', { name: 'Confira os próximos passos' })).toBeVisible();
      await expect(page.getByRole('status')).not.toContainText('Enviamos um link');
      await noHorizontalOverflow(page);
      // SMTP local: mensagens ficam no Mailpit, sem qualquer envio externo.
      const emailLink = async (address: string, kind: string) => {
        let found = '';
        await expect
          .poll(
            async () => {
              const response = await page.request.get(
                `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent('to:' + address)}`,
              );
              const inbox = await response.json();
              for (const message of inbox.messages ?? []) {
                const detail = await (await page.request.get(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
                const hrefs = await page.evaluate(
                  (html: string) =>
                    [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a')].map(
                      (a) => a.getAttribute('href') ?? '',
                    ),
                  detail.HTML,
                );
                found = hrefs.find((h) => h.includes('/auth/v1/verify?') && h.includes(`type=${kind}`)) ?? '';
                if (found) return true;
              }
              return false;
            },
            { message: 'E-mail de teste local não encontrado', timeout: 15000 },
          )
          .toBe(true);
        const parsed = new URL(found);
        if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw Error('Link de teste não é local.');
        return found;
      };
      const openEmail = async (link: string) => {
        try {
          await page.goto(link);
        } catch {
          throw Error('Falha no callback local de autenticação.');
        }
      };
      await page.goto('/recuperar-senha');
      await page.locator('input[name=email]').fill(email);
      await page.locator('button[type=submit]').click();
      await expect(page.getByRole('status')).toBeVisible();
      await openEmail(await emailLink(email, 'recovery'));
      expect(new URL(page.url()).pathname).toBe('/nova-senha');
      await page.locator('input[name=password]').fill(password);
      await page.locator('input[name=confirmation]').fill('does-not-match');
      await page.locator('button[type=submit]').click();
      await expect(page.locator('.pl-error[role=alert]')).toContainText('não coincidem');
      // React limpa campos não controlados após a Server Action, inclusive erro de validação.
      await page.locator('input[name=password]').fill(password);
      await page.locator('input[name=confirmation]').fill(password);
      await page.locator('button[type=submit]').click();
      await expect(page.getByRole('status')).toContainText('Senha alterada com sucesso');
      expect(new URL(page.url()).pathname).toBe('/entrar');
      await page.locator('input[name=email]').fill(email);
      await page.locator('input[name=password]').fill(password);
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/portal');
      // Sessão de senha comum não dá acesso ao formulário de recuperação.
      await page.goto('/nova-senha');
      await expect(page.locator('input[name=confirmation]')).toHaveCount(0);
      await page.goto('/portal/seguranca');
      await page.locator('input[name=email]').fill(newEmail);
      await page.locator('input[name=password]').fill(password);
      await page.locator('button[type=submit]').click();
      await expect(page.locator('form [role=status]')).toContainText('A alteração só estará concluída');
      const current = await admin.auth.admin.getUserById(id);
      expect(current.data.user?.email).toBe(email);
      await openEmail(await emailLink(email, 'email_change'));
      expect((await admin.auth.admin.getUserById(id)).data.user?.email).toBe(email);
      await openEmail(await emailLink(newEmail, 'email_change'));
      expect((await admin.auth.admin.getUserById(id)).data.user?.email).toBe(newEmail);
      await page.goto('/portal/seguranca');
      await expect(page.getByText(newEmail, { exact: true })).toBeVisible();
      await noHorizontalOverflow(page);
    } finally {
      await admin.auth.admin.deleteUser(id);
    }
  });
}
