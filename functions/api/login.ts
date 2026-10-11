/**
 * Cloudflare Pages Functions 登录鉴权接口
 * 校验用户名密码后签发 HMAC 会话令牌，供 /api/llm-proxy 转发前鉴权使用。
 * 可通过环境变量覆盖默认账号：CLAIMLEX_USER / CLAIMLEX_PASS / CLAIMLEX_SESSION_SECRET
 */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 会话有效期 12 小时
const DEFAULT_USER = 'claimlex';
const DEFAULT_PASS = 'citicsz';
const DEFAULT_SECRET = 'claimlex-session-secret-2026';

interface PagesFunctionContext {
  request: Request;
  env?: Record<string, string | undefined>;
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 校验会话令牌（格式: encodeURIComponent(username).expiresAt.signature）
 */
export async function verifySessionToken(token: string | null | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  let username: string;
  try {
    username = decodeURIComponent(parts[0]);
  } catch {
    return false;
  }
  const expected = await hmacSign(`${username}.${expiresAt}`, secret);
  return expected === parts[2];
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  const req = context.request;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    return json({ error: { message: 'Method Not Allowed' } }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: { message: '请求体必须为 JSON' } }, 400);
  }

  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');

  const expectedUser = (context.env?.CLAIMLEX_USER || DEFAULT_USER).trim();
  const expectedPass = context.env?.CLAIMLEX_PASS || DEFAULT_PASS;

  if (username !== expectedUser || password !== expectedPass) {
    return json({ error: { message: '用户名或密码错误' } }, 401);
  }

  const secret = context.env?.CLAIMLEX_SESSION_SECRET || DEFAULT_SECRET;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = await hmacSign(`${username}.${expiresAt}`, secret);
  const token = `${encodeURIComponent(username)}.${expiresAt}.${signature}`;

  return json({ ok: true, username, token, expiresAt });
}
