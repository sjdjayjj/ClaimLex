import { CalculationParams } from '../core/types';
import { LLMConfig, LLMPreset, ParsedAnalysisResult } from './llmTypes';
import { JUDGMENT_PARSER_PROMPT } from '../parser/prompt';
import dayjs from 'dayjs';

const STORAGE_KEY = 'FINANCIAL_AGENT_LLM_CONFIG';

/**
 * 常用厂商预设配置，提供开箱即用的标准 URL 与 Model
 */
export const LLM_PRESETS: LLMPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek (深度求索)',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    apiVersion: 'v1',
    model: 'deepseek-chat',
    description: '国内高性价比大模型，具备极强的法律文书逻辑推理与长文本解析能力',
  },
  {
    id: 'gemini',
    name: 'Google Gemini (官方兼容)',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiVersion: 'v1beta',
    model: 'gemini-3.8-flash',
    description: 'Google 官方提供的 OpenAI 兼容接口（支持 3.8 flash 等最新模型）',
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiVersion: 'v1',
    model: 'gpt-4o',
    description: '国际通用顶尖模型，长文本与复杂结构化 JSON 抽取极度精准',
  },
  {
    id: 'qwen',
    name: '阿里通义千问 (DashScope)',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiVersion: 'v1',
    model: 'qwen-plus',
    description: '通义千问官方 OpenAI 兼容接口，中文司法金融理解表现卓越',
  },
  {
    id: 'moonshot',
    name: '月之暗面 (Kimi / Moonshot)',
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    apiVersion: 'v1',
    model: 'moonshot-v1-32k',
    description: '超长上下文窗口，特别适合百页超长借款合同与综合判决书',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow DeepSeek-V3)',
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiVersion: 'v1',
    model: 'deepseek-ai/DeepSeek-V3',
    description: '国内高速大模型托管平台，支持多种开源顶尖模型',
  },
  {
    id: 'custom',
    name: '自定义 API 接口 / 本地私有化模型 (Ollama/vLLM)',
    apiUrl: 'http://localhost:11434/v1/chat/completions',
    apiVersion: 'v1',
    model: 'qwen2.5:14b',
    description: '支持任何符合 OpenAI 格式的私有部署模型、中转代理或第三方中台',
  },
];

/**
 * 默认配置
 */
export const DEFAULT_LLM_CONFIG: LLMConfig = {
  providerName: 'DeepSeek (深度求索)',
  apiUrl: 'https://api.deepseek.com/chat/completions',
  apiVersion: 'v1',
  method: 'POST',
  model: 'deepseek-chat',
  apiKey: '',
  timeoutMs: 90000,
  temperature: 0.1, // 法律要素抽取建议极低温度，保证确定性
  customHeaders: [],
  useLocalProxy: true, // 默认开启本地开发代理，彻底消除浏览器跨域 CORS 拦截
};

/**
 * 智能修正 URL：针对常见的输入不完整（如缺少 /chat/completions 或 Google Gemini 缺少 /openai 路径）进行智能修复
 */
export function fixIncompleteApiUrl(url: string): { fixedUrl: string; hasSuggestion: boolean; reason?: string } {
  if (!url) return { fixedUrl: '', hasSuggestion: false };
  let trimmed = url.trim().replace(/\/+$/, '');

  // 针对 Google Gemini
  if (trimmed.includes('generativelanguage.googleapis.com')) {
    if (trimmed.endsWith('/v1beta') || trimmed.endsWith('/v1')) {
      return {
        fixedUrl: `${trimmed}/openai/chat/completions`,
        hasSuggestion: true,
        reason: 'Google Gemini 的 OpenAI 兼容调用需要以 /openai/chat/completions 结尾',
      };
    }
    if (trimmed.endsWith('/openai')) {
      return {
        fixedUrl: `${trimmed}/chat/completions`,
        hasSuggestion: true,
        reason: '补齐 /chat/completions 请求端点路径',
      };
    }
  }

  // 针对普通以 /v1 结尾的 OpenAI 兼容端点，缺少 /chat/completions
  if (/\/v1(?:beta)?$/i.test(trimmed)) {
    return {
      fixedUrl: `${trimmed}/chat/completions`,
      hasSuggestion: true,
      reason: '补齐 /chat/completions 请求端点路径',
    };
  }

  return { fixedUrl: trimmed, hasSuggestion: false };
}

/**
 * 读取本地持久化配置
 */
export function loadLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LLM_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LLM_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

/**
 * 保存配置到本地
 */
export function saveLLMConfig(config: LLMConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('无法持久化保存 LLM 配置:', err);
  }
}

/**
 * 构造实际发送的 HTTP 请求头
 */
export function buildRequestHeaders(config: LLMConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey && config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  // 附加自定义请求头
  if (Array.isArray(config.customHeaders)) {
    for (const h of config.customHeaders) {
      if (h.enabled && h.key && h.key.trim()) {
        headers[h.key.trim()] = h.value || '';
      }
    }
  }

  // 若设置了 apiVersion 且非默认，可附带版本头
  if (config.apiVersion && config.apiVersion.trim()) {
    headers['x-api-version'] = config.apiVersion.trim();
  }

  return headers;
}

/**
 * 智能发送 HTTP 请求，支持本地代理转发与跨域自动降级
 */
async function dispatchApiRequest(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  bodyJson: any,
  signal: AbortSignal,
  useLocalProxy: boolean
): Promise<Response> {
  // 1. 如果启用了代理，尝试通过 /api/llm-proxy 转发
  if (useLocalProxy) {
    try {
      const proxyHeaders = {
        ...headers,
        'x-target-url': targetUrl,
      };
      const proxyRes = await fetch('/api/llm-proxy', {
        method,
        headers: proxyHeaders,
        body: JSON.stringify(bodyJson),
        signal,
      });

      // 若当前部署环境（如纯静态托管）不支持该路由返回 404 或 405，自动降级直连
      if (proxyRes.status === 404 || proxyRes.status === 405) {
        console.warn(`代理端点返回 HTTP ${proxyRes.status}，自动降级直连目标 API`);
        return await fetch(targetUrl, {
          method,
          headers,
          body: JSON.stringify(bodyJson),
          signal,
        });
      }

      return proxyRes;
    } catch (proxyError: any) {
      console.warn('代理请求异常，降级尝试直连:', proxyError.message);
    }
  }

  // 2. 尝试直连
  try {
    return await fetch(targetUrl, {
      method,
      headers,
      body: JSON.stringify(bodyJson),
      signal,
    });
  } catch (directError: any) {
    // 3. 如果直连出现 Failed to fetch (典型的跨域 CORS 拦截)，尝试通过代理救急
    if (directError.message?.includes('Failed to fetch')) {
      console.info('直连触发 Failed to fetch，尝试通过代理转发重试...');
      const proxyHeaders = {
        ...headers,
        'x-target-url': targetUrl,
      };
      const fallbackRes = await fetch('/api/llm-proxy', {
        method,
        headers: proxyHeaders,
        body: JSON.stringify(bodyJson),
        signal,
      });
      if (fallbackRes.status !== 404 && fallbackRes.status !== 405) {
        return fallbackRes;
      }
    }
    throw directError;
  }
}

/**
 * 测试大模型连通性
 */
export async function testLLMConnection(config: LLMConfig): Promise<{ success: boolean; message: string; latencyMs: number }> {
  if (!config.apiUrl || !config.apiUrl.trim()) {
    throw new Error('API 调用地址不能为空');
  }
  if (!config.model || !config.model.trim()) {
    throw new Error('模型名称不能为空');
  }

  const { fixedUrl } = fixIncompleteApiUrl(config.apiUrl);
  const targetUrl = fixedUrl || config.apiUrl.trim();

  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.timeoutMs || 30000, 30000));

  try {
    const headers = buildRequestHeaders(config);
    const body = {
      model: config.model.trim(),
      messages: [
        { role: 'system', content: 'You are a test assistant. Answer in one brief sentence.' },
        { role: 'user', content: 'Ping! Are you operational? Please reply with "OK".' },
      ],
      temperature: 0.1,
      max_tokens: 30,
    };

    const response = await dispatchApiRequest(
      targetUrl,
      config.method || 'POST',
      headers,
      body,
      controller.signal,
      config.useLocalProxy !== false
    );

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text().catch(() => '');
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(`认证失败 (HTTP ${response.status})：请检查 API Key 是否填写正确、有效或具有该模型权限。\n详情: ${errorDetail}`);
      }
      if (response.status === 404) {
        throw new Error(`地址或模型未找到 (HTTP 404)：\n1. 请检查 API 调用完整地址是否包含 /openai/chat/completions；\n2. 确认模型名称标识是否与服务提供商后台完全一致。\n详情: ${errorDetail}`);
      }
      if (response.status === 429) {
        throw new Error(`请求受限 (HTTP 429)：账户额度已耗尽或触发限流频率控制。\n详情: ${errorDetail}`);
      }
      throw new Error(`API 返回异常 [HTTP ${response.status}]: ${errorDetail || response.statusText}`);
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || '连接正常';

    return {
      success: true,
      message: `连通成功！模型回复: "${replyText.trim()}" (响应耗时: ${latencyMs}ms)`,
      latencyMs,
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`连接超时（超过 30 秒）：请检查网络连接、API 代理或服务器状态。`);
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      const isGoogle = targetUrl.includes('googleapis.com');
      let customTips = '';
      if (isGoogle) {
        customTips = `\n【针对 Google Gemini 专项排查】：\n1. 请确认本地代理工具已开启系统/全局代理；\n2. 完整 URL 需包含 /openai/chat/completions。`;
      }
      throw new Error(`网络请求失败 (Failed to fetch)：\n请确认 API 地址可连通或本地代理正常。${customTips}`);
    }
    throw error;
  }
}

/**
 * 健壮的 JSON 解析器：从大模型输出的混合文本或 Markdown 中提取 JSON
 */
export function extractJSONFromLLMOutput(rawText: string): any {
  if (!rawText) {
    throw new Error('大模型未返回任何文本内容');
  }

  // 1. 尝试直接解析
  try {
    return JSON.parse(rawText.trim());
  } catch {
    // 忽略，继续尝试提取
  }

  // 2. 匹配 ```json ... ``` 块
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = jsonBlockRegex.exec(rawText);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      // 忽略，继续尝试大括号截取
    }
  }

  // 3. 寻找最外层的 { ... }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = rawText.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (e: any) {
      throw new Error(`从模型输出中提取到 JSON 片段，但解析失败: ${e.message}\n原始片段:\n${candidate.slice(0, 300)}...`);
    }
  }

  throw new Error(`大模型输出中未找到合法的 JSON 格式数据。原始输出片段: ${rawText.slice(0, 200)}...`);
}

/**
 * 校验并规范化大模型抽取的要素参数
 */
function normalizeExtractedParams(rawJson: any): { params: CalculationParams; extra: Partial<ParsedAnalysisResult> } {
  const today = dayjs().format('YYYY-MM-DD');

  // 核心参数校验与回退
  const params: CalculationParams = {
    baseDate: typeof rawJson.baseDate === 'string' && rawJson.baseDate.length >= 8 ? rawJson.baseDate : today,
    endDate: today,
    principal: Number(rawJson.principal) || 0,
    baseInterest: Number(rawJson.baseInterest) || 0,
    basePenalty: Number(rawJson.basePenalty) || 0,
    rateMode: ['LPR', 'BENCHMARK', 'FIXED'].includes(rawJson.rateMode) ? rawJson.rateMode : 'LPR',
    lprTerm: rawJson.lprTerm === '1Y' ? '1Y' : '5Y',
    lprBp: Number(rawJson.lprBp) || 0,
    lprFloatRatio: Number(rawJson.lprFloatRatio) || 0,
    fixedRate: rawJson.fixedRate ? Number(rawJson.fixedRate) : undefined,
    penaltyMultiple: Number(rawJson.penaltyMultiple) || 1.5,
    compoundMode: ['INT_ONLY', 'INT_AND_PENALTY', 'NONE'].includes(rawJson.compoundMode) ? rawJson.compoundMode : 'INT_AND_PENALTY',
    delayInterestEnabled: rawJson.delayInterestEnabled !== false,
  };

  const reasoning = typeof rawJson.reasoning === 'string' && rawJson.reasoning.trim()
    ? rawJson.reasoning.trim()
    : '大模型已完成裁判要素归纳，未返回详细理由文本。';

  return {
    params,
    extra: {
      caseNo: rawJson.caseNo,
      plaintiff: rawJson.plaintiff,
      defendant: rawJson.defendant,
      reasoning,
      keyPoints: Array.isArray(rawJson.keyPoints) ? rawJson.keyPoints : [],
    },
  };
}

/**
 * 调用真实大模型进行裁判文书智能分析与要素提取
 */
export async function analyzeJudgmentWithLLM(
  documentText: string,
  config: LLMConfig,
  onProgress?: (statusText: string) => void
): Promise<ParsedAnalysisResult> {
  if (!documentText || !documentText.trim()) {
    throw new Error('裁判文书内容为空，请输入或上传文书文本');
  }
  if (!config.apiUrl || !config.apiUrl.trim()) {
    throw new Error('未配置大模型 API 地址，请在右上角“大模型配置”中设置');
  }
  if (!config.apiKey || !config.apiKey.trim()) {
    throw new Error('未配置 API 密钥 (API Key)，请在右上角“大模型配置”中输入并保存');
  }

  const { fixedUrl } = fixIncompleteApiUrl(config.apiUrl);
  const targetUrl = fixedUrl || config.apiUrl.trim();

  onProgress?.('正在向大模型组装司法审判上下文与 Prompt...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 90000);

  try {
    const headers = buildRequestHeaders(config);

    const userContent = `以下是需要深度审阅和清算的借贷纠纷裁判文书/合同文本内容：\n\n${documentText.trim()}\n\n请严格按照要求提取 JSON 数据并返回。`;

    const requestBody = {
      model: config.model.trim(),
      messages: [
        { role: 'system', content: JUDGMENT_PARSER_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: config.temperature ?? 0.1,
    };

    onProgress?.(`正在请求大模型 [${config.model}] 进行司法要素深度推理 (请稍候)...`);

    const response = await dispatchApiRequest(
      targetUrl,
      config.method || 'POST',
      headers,
      requestBody,
      controller.signal,
      config.useLocalProxy !== false
    );

    clearTimeout(timeout);

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errJson = await response.json();
        errorDetail = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errorDetail = await response.text().catch(() => '');
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(`大模型 API 认证失败 (HTTP ${response.status})：请检查 API Key 是否有效。详情: ${errorDetail}`);
      }
      if (response.status === 404) {
        throw new Error(`大模型接口地址或模型标识错误 (HTTP 404)：请检查请求路径与模型名称。详情: ${errorDetail}`);
      }
      if (response.status === 429) {
        throw new Error(`大模型调用频次超限或额度不足 (HTTP 429)。详情: ${errorDetail}`);
      }
      throw new Error(`大模型调用异常 [HTTP ${response.status}]: ${errorDetail || response.statusText}`);
    }

    onProgress?.('已接收模型返回数据，正在进行格式化解析与结构化校准...');

    const responseData = await response.json();
    const rawContent = responseData.choices?.[0]?.message?.content || '';

    if (!rawContent) {
      throw new Error('大模型响应结果中未包含有效文本内容 (choices[0].message.content 为空)');
    }

    // 结构化提取 JSON
    const parsedJson = extractJSONFromLLMOutput(rawContent);
    const { params, extra } = normalizeExtractedParams(parsedJson);

    return {
      params,
      caseNo: extra.caseNo,
      plaintiff: extra.plaintiff,
      defendant: extra.defendant,
      reasoning: extra.reasoning || '',
      keyPoints: extra.keyPoints,
      rawOutput: rawContent,
    };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`大模型分析处理超时（超过 ${Math.round((config.timeoutMs || 90000) / 1000)} 秒），请检查网络稳定性或适当调整超时设置。`);
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      const isGoogle = targetUrl.includes('googleapis.com');
      let customTips = '';
      if (isGoogle) {
        customTips = `\n【针对 Google Gemini 专项排查】：\n1. 请确认本地代理工具已开启系统/全局代理；\n2. 完整 URL 需包含 /openai/chat/completions。`;
      }
      throw new Error(`网络请求失败 (Failed to fetch)：\n请确认 API 地址可连通或本地代理正常。${customTips}`);
    }
    throw error;
  }
}
