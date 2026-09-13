import { CalculationParams, RepaymentRecord, RepaymentReceiptMeta } from '../core/types';

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
 * 批量案件中的单个借款人/被告客户要素明细
 */
export interface BatchCaseClient {
  /** 序号或唯一索引 */
  id: string;
  /** 该客户对应的具体子案号 (例如 (2022)粤0304民初21154号) */
  caseNo?: string;
  /** 被告姓名 (例如 谢添全) */
  defendant: string;
  /** 性别 */
  gender?: string;
  /** 民族 */
  nation?: string;
  /** 身份证号码 */
  idCard?: string;
  /** 身份证地址 */
  idAddress?: string;
  /** 欠款本金余额 (元) */
  principal: number;
  /** 暂计利息 (元) */
  baseInterest: number;
  /** 暂计罚息 (元) */
  basePenalty: number;
  /** 暂计复利 (元) */
  baseCompound?: number;
  /** 截息日期 (YYYY-MM-DD，以此日期为起算点) */
  cutoffDate?: string;
  /** 合同执行年利率 (%)，如 7.18 代表 7.18%/年；每个人可不同 */
  annualRate?: number;
  /** 固定年利率 (%) */
  fixedRate?: number;
  /** 罚息年利率 (%)，如 10.77 */
  penaltyRate?: number;
  /** 罚息上浮倍数 (如 1.5 代表上浮50%) */
  penaltyMultiple?: number;
  /** 利率模式: 'FIXED' | 'LPR' | 'BENCHMARK' */
  rateMode?: import('../core/types').RateMode;
  /** LPR 期限品种: '1Y' | '5Y' */
  lprTerm?: import('../core/types').LPRTerm;
  /** LPR 浮动加减点 (BP) */
  lprBp?: number;
  /** 加倍迟延履行金起算日 / 履行期届满日 (YYYY-MM-DD) */
  executionDueDate?: string;
  /** 计息天数规则 */
  dayCountConvention?: import('../core/types').DayCountConvention;
  /** 案件受理费 (元) */
  litigationFee?: number;
  /** 保全费 (元) */
  preservationFee?: number;
  /** 备注 */
  notes?: string;
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
  /** 是否为批量案件/附表判决 */
  isBatchCase?: boolean;
  /** 批量案件借款人客户列表 (附表中抽取的客户明细) */
  batchClients?: BatchCaseClient[];
  /** 当前选中的客户 ID */
  selectedClientId?: string;
  /** 提取到的银行扣款回单基本信息 */
  receiptMeta?: RepaymentReceiptMeta;
  /** 提取到的扣款明细 / 还款流水记录列表 */
  repayments?: RepaymentRecord[];
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
