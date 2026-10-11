/**
 * 站点简单登录与会话鉴权服务
 * 登录成功后由服务端 (/api/login) 签发 HMAC 会话令牌，
 * 令牌仅保存在 sessionStorage（关闭浏览器标签页即失效），并随代理请求附带鉴权头。
 */
const SESSION_KEY = 'CLAIMLEX_SESSION';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 会话有效期 12 小时

export interface ClaimlexSession {
  username: string;
  token: string;
  expiresAt: number;
}

/**
 * 读取当前会话（过期自动清除）
 */
export function getSession(): ClaimlexSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClaimlexSession;
    if (!parsed?.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 调用服务端登录接口校验用户名密码并签发会话令牌
 */
export async function login(username: string, password: string): Promise<ClaimlexSession> {
  if (!username.trim() || !password) {
    throw new Error('请输入用户名与密码');
  }

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* 忽略非 JSON 响应 */
  }

  if (!res.ok) {
    throw new Error(data?.error?.message || `登录失败 (HTTP ${res.status})`);
  }

  const session: ClaimlexSession = {
    username: data.username,
    token: data.token,
    expiresAt: data.expiresAt,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * 退出登录
 */
export function logout(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* 忽略 */
  }
}

/**
 * 供大模型代理转发 (/api/llm-proxy) 附带的服务端鉴权头
 */
export function getAuthHeaders(): Record<string, string> {
  const session = getSession();
  return session ? { 'x-claimlex-auth': session.token } : {};
}
