/**
 * Cloudflare Pages Functions 全球边缘通用转发代理
 * 解决浏览器前端直接调用大模型接口时的 CORS 跨域拦截
 * 需携带登录后签发的 x-claimlex-auth 会话令牌方可转发
 */
import { verifySessionToken } from './login';

const DEFAULT_SESSION_SECRET = 'claimlex-session-secret-2026';

interface PagesFunctionContext {
  request: Request;
  env?: Record<string, string | undefined>;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  const req = context.request;

  // 跨域预检请求直接放行
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  // 会话鉴权：未登录或令牌无效/过期一律拒绝转发
  const sessionToken = req.headers.get('x-claimlex-auth');
  const secret = context.env?.CLAIMLEX_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const isAuthenticated = await verifySessionToken(sessionToken, secret);
  if (!isAuthenticated) {
    return new Response(JSON.stringify({ error: { message: '会话无效或已过期，请重新登录' } }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const targetUrl = req.headers.get('x-target-url');
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: { message: 'Missing x-target-url header' } }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }

  // 复制请求头，过滤掉 host 与 x-target-url
  const forwardHeaders = new Headers(req.headers);
  forwardHeaders.delete('host');
  forwardHeaders.delete('x-target-url');

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: forwardHeaders,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = await req.arrayBuffer();
    }

    const response = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: { message: `Cloudflare 边缘代理转发失败: ${err.message}` },
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
