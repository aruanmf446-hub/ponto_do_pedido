import { createHmac, createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/core/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sha(input: Buffer | string) { return createHash('sha256').update(input).digest('hex'); }
function hmac(key: Buffer | string, input: string) { return createHmac('sha256', key).update(input).digest(); }

async function requestR2(method: 'GET' | 'PUT', key: string, data?: Buffer, type = 'image/webp') {
  const id = process.env.PDP_R2_ACCOUNT_ID;
  const access = process.env.PDP_R2_ACCESS_KEY_ID;
  const secret = process.env.PDP_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.PDP_R2_BUCKET;
  if (!id || !access || !secret || !bucket) return null;
  const host = `${id}.r2.cloudflarestorage.com`;
  const path = '/' + [bucket, ...key.split('/')].map(encodeURIComponent).join('/');
  const now = new Date();
  const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = stamp.slice(0, 8);
  const payloadHash = sha(data ?? Buffer.alloc(0));
  const headers = new Headers({
    host, 'x-amz-date': stamp, 'x-amz-content-sha256': payloadHash,
  });
  if (method === 'PUT') headers.set('content-type', type);
  const signedNames = [...headers.keys()].sort();
  const signed = signedNames.join(';');
  const canonicalHeaders = signedNames.map((name) => `${name}:${headers.get(name)?.trim()}\n`).join('');
  const canonical = [method, path, '', canonicalHeaders, signed, payloadHash].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const signText = ['AWS4-HMAC-SHA256', stamp, scope, sha(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac('AWS4' + secret, date), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(signText).digest('hex');
  headers.set('authorization', `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signed}, Signature=${signature}`);
  return fetch(`https://${host}${path}`, { method, headers, ...(data ? { body: new Uint8Array(data) } : {}), cache: 'no-store' });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sessão expirada.' }, { status: 401 });
  const type = req.headers.get('content-type') ?? '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return NextResponse.json({ error: 'Formato inválido.' }, { status: 415 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > 2 * 1024 * 1024) return NextResponse.json({ error: 'A foto deve ter até 2 MB.' }, { status: 413 });
  const signatures = { 'image/jpeg': buf[0] === 0xff && buf[1] === 0xd8, 'image/png': buf.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'image/webp': buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' };
  if (!signatures[type as keyof typeof signatures]) return NextResponse.json({ error: 'Arquivo de imagem inválido.' }, { status: 415 });
  try {
    const response = await requestR2('PUT', `profiles/${user.id}/avatar`, buf, type);
    if (!response?.ok) return NextResponse.json({ error: 'Não foi possível salvar no Cloudflare R2.' }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Armazenamento indisponível.' }, { status: 503 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  try {
    const response = await requestR2('GET', `profiles/${user.id}/avatar`);
    if (!response?.ok) return new Response(null, { status: response?.status === 404 ? 404 : 502 });
    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    return new Response(bytes, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
