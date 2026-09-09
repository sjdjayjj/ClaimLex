import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';
import { URL } from 'node:url';

/**
 * 常见本地科学上网代理端口候选
 */
const COMMON_PROXY_PORTS = [10808, 7890, 7897, 10809, 1080, 8080];

/**
 * 探测本地可用的 HTTP CONNECT 代理地址
 */
async function detectLocalProxy(): Promise<{ host: string; port: number } | null> {
  // 1. 优先使用环境变量
  const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (envProxy) {
    try {
      const parsed = new URL(envProxy.startsWith('http') ? envProxy : `http://${envProxy}`);
      return { host: parsed.hostname, port: Number(parsed.port) || 10808 };
    } catch {}
  }

  // 2. 依次探测本地代理端口
  for (const port of COMMON_PROXY_PORTS) {
    const isAlive = await new Promise<boolean>((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port, timeout: 200 }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.on('timeout', () => {
        sock.destroy();
        resolve(false);
      });
    });
    if (isAlive) {
      return { host: '127.0.0.1', port };
    }
  }

  return null;
}

/**
 * 通过 HTTP CONNECT 隧道创建安全 TLS 连接
 */
function createTunneledTLSSocket(
  proxy: { host: string; port: number },
  targetHost: string,
  targetPort: number
): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const connectReq = http.request({
      host: proxy.host,
      port: proxy.port,
      method: 'CONNECT',
      path: `${targetHost}:${targetPort}`,
      headers: {
        Host: `${targetHost}:${targetPort}`,
      },
    });

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return reject(new Error(`代理拒绝建立隧道 (HTTP ${res.statusCode} ${res.statusMessage})`));
      }

      // 在已建立的 TCP 隧道上进行 TLS 握手
      const tlsSocket = tls.connect({
        socket,
        servername: targetHost,
      }, () => {
        resolve(tlsSocket);
      });

      tlsSocket.on('error', (err) => {
        reject(new Error(`与目标服务器建立 TLS 握手失败: ${err.message}`));
      });
    });

    connectReq.on('error', (err) => {
      reject(new Error(`连接本地代理 ${proxy.host}:${proxy.port} 失败: ${err.message}`));
    });

    connectReq.setTimeout(10000, () => {
      connectReq.destroy();
      reject(new Error(`连接本地代理超时 (10s)`));
    });

    connectReq.end();
  });
}

/**
 * 本地开发大模型通用转发代理插件
 * 彻底解决前端浏览器的跨域 (CORS) 拦截，并自动接驳本地科学上网代理
 */
function llmProxyPlugin(): Plugin {
  return {
    name: 'llm-proxy-plugin',
    configureServer(server) {
      server.middlewares.use('/api/llm-proxy', async (req, res) => {
        // 允许跨域
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const targetUrlStr = req.headers['x-target-url'] as string;
        if (!targetUrlStr) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: '缺少 x-target-url 请求头' } }));
          return;
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(targetUrlStr);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: `非法的目标 URL: ${targetUrlStr}` } }));
          return;
        }

        // 读取完整的 body
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on('end', async () => {
          const bodyBuffer = Buffer.concat(chunks);

          // 准备转发 Headers
          const forwardHeaders: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            const lowerKey = k.toLowerCase();
            if (['host', 'x-target-url', 'connection', 'content-length'].includes(lowerKey)) {
              continue;
            }
            if (v !== undefined) {
              forwardHeaders[k] = v;
            }
          }
          forwardHeaders['host'] = targetUrl.host;
          forwardHeaders['content-length'] = bodyBuffer.length.toString();

          const targetPort = targetUrl.port ? Number(targetUrl.port) : (targetUrl.protocol === 'https:' ? 443 : 80);
          const isHttps = targetUrl.protocol === 'https:';

          // 检测是否需要走代理（境外域名如 googleapis.com, openai.com 等，或用户本地开启了代理）
          const isForeignHost = /googleapis\.com|google\.com|openai\.com|anthropic\.com/i.test(targetUrl.hostname);
          const detectedProxy = await detectLocalProxy();

          try {
            let proxyReq: http.ClientRequest;

            // 如果是 HTTPS 境外服务且检测到本地代理可用，通过代理隧道转发
            if (isHttps && detectedProxy && (isForeignHost || process.env.HTTPS_PROXY)) {
              const tlsSocket = await createTunneledTLSSocket(detectedProxy, targetUrl.hostname, targetPort);

              proxyReq = https.request({
                path: targetUrl.pathname + targetUrl.search,
                method: req.method || 'POST',
                headers: forwardHeaders,
                createConnection: () => tlsSocket,
                timeout: 90000,
              });
            } else {
              // 国内直连或普通请求
              const client = isHttps ? https : http;
              proxyReq = client.request(targetUrl, {
                method: req.method || 'POST',
                headers: forwardHeaders,
                timeout: 90000,
              });
            }

            proxyReq.on('response', (proxyRes) => {
              res.statusCode = proxyRes.statusCode || 200;
              for (const [hk, hv] of Object.entries(proxyRes.headers)) {
                if (hv !== undefined && hk.toLowerCase() !== 'access-control-allow-origin') {
                  res.setHeader(hk, hv);
                }
              }
              res.setHeader('Access-Control-Allow-Origin', '*');
              proxyRes.pipe(res);
            });

            proxyReq.on('error', (err: any) => {
              console.error('[LLM Proxy Forward Error]:', err.message);
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: {
                    message: `代理转发失败: ${err.message}。请检查本地代理工具是否正常运行。`,
                  },
                })
              );
            });

            proxyReq.on('timeout', () => {
              proxyReq.destroy();
              res.statusCode = 504;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: '目标服务器响应超时 (90s)' } }));
            });

            if (bodyBuffer.length > 0) {
              proxyReq.write(bodyBuffer);
            }
            proxyReq.end();
          } catch (tunnelError: any) {
            console.error('[Tunnel Error]:', tunnelError.message);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: {
                  message: `隧道连接失败: ${tunnelError.message}。`,
                },
              })
            );
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), llmProxyPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
