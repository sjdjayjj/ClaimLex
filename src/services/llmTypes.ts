import { CalculationParams } from '../core/types';

/**
 * 自定义请求头键值对
 */
export interface HeaderItem {
  key: string;
  value: string;
  enabled: boolean;
}

/**
 * 大模型 API 完整配置模型
 */
export interface LLMConfig {
  /** 配置名称/标签（如 DeepSeek V3、GPT-4o、通义千问等） */
  providerName: string;
  /** 完整 API URL 地址 (如 https://api.deepseek.com/chat/completions) */
  apiUrl: string;
  /** 接口版本标识 (如 v1、v2 或 2024-02-15) */
  apiVersion: string;
  /** 请求方法，通常为 POST */
  method: 'POST' | 'PUT';
  /** 模型名称标识 (如 deepseek-chat, gpt-4o, qwen-plus) */
  model: string;
  /** API 认证密钥 (Bearer Token 或 API Key) */
  apiKey: string;
  /** 超时时间 (毫秒)，默认 60000 */
  timeoutMs: number;
  /** 采样温度 */
  temperature: number;
  /** 自定义请求头列表 */
  customHeaders: HeaderItem[];
  /** 是否通过本地开发服务器代理转发 (可彻底消除浏览器跨域 CORS 拦截) */
  useLocalProxy: boolean;
}

/**
 * 结构化文书解析产物（包含参数与司法论证）
 */
export interface ParsedAnalysisResult {
  /** 提取的核心计算参数 */
  params: CalculationParams;
  /** 案号 */
  caseNo?: string;
  /** 原告信息 */
  plaintiff?: string;
  /** 被告信息 */
  defendant?: string;
  /** 合同约定与裁判主文深度分析理由 */
  reasoning: string;
  /** 关键裁判要素要点列表 */
  keyPoints?: string[];
  /** 大模型原始输出文本 (用于回溯与审计) */
  rawOutput?: string;
}

/**
 * 预设的大模型配置模板
 */
export interface LLMPreset {
  id: string;
  name: string;
  apiUrl: string;
  apiVersion: string;
  model: string;
  description: string;
  defaultHeaders?: Record<string, string>;
}
