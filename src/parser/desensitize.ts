/**
 * 客户敏感信息统一脱敏模块
 * 任何上传/粘贴进系统的文书文本，在展示与发送给大模型前都必须经过本模块处理：
 * - 身份证号（18 位 / 15 位）
 * - 手机号
 * - 银行卡号 / 贷款账号等 12 位以上纯数字串
 * - 上下文命名的自然人姓名（被告：/借款人：/姓名：等）
 * - 批量附表「序号|案号|被告|...」行中的姓名单元格
 */

/** 判断是否已包含脱敏符（避免二次脱敏破坏已有「某/＊」样例） */
function alreadyMasked(s: string): boolean {
  return s.includes('某') || s.includes('*') || s.includes('＊');
}

/**
 * 姓名脱敏（结构化字段用）：保留首字，其余替换为「某」
 * 例：谢添全 -> 谢某；张三 -> 张某
 */
export function maskChineseName(name?: string | null): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed || alreadyMasked(trimmed)) return trimmed;
  if (trimmed.length === 1) return trimmed;
  return trimmed[0] + '某';
}

/**
 * 证件号脱敏（结构化字段用）：保留前 3 位与后 2 位
 * 例：440981198803294918 -> 440***********18
 */
export function maskIdNumber(id?: string | null): string {
  if (!id) return '';
  const trimmed = id.trim();
  if (!trimmed || alreadyMasked(trimmed)) return trimmed;
  if (trimmed.length <= 5) return trimmed;
  const head = trimmed.slice(0, 3);
  const tail = trimmed.slice(-2);
  return `${head}${'*'.repeat(Math.max(4, trimmed.length - 5))}${tail}`;
}

/** 18 位身份证号（带前后边界，避免吞掉更长卡号的子串） */
const ID18_RE = /(?<![\dXx])[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?![\dXx])/g;
/** 15 位老身份证号 */
const ID15_RE = /(?<!\d)[1-9]\d{5}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}(?!\d)/g;
/** 手机号 */
const PHONE_RE = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
/** 12-25 位纯数字串（银行卡号/贷款账号等） */
const LONG_NUM_RE = /(?<!\d)\d{12,25}(?!\d)/g;
/**
 * 借据号/协议号标签：贷款协议号是附表协议号与回单贷款借据号的匹配键（如文书 811032383950002 ↔ 回单 811032383950/002），
 * 项目整体不脱敏——脱敏成 8110*****950 后回单解析只能截到 8110、附表协议号也会提取不全，导致分账匹配失败
 */
const RECEIPT_NO_LABEL = '(?:贷款借据号|借据号|借据编号|贷款协议号|协议号|协议编号|合同编号)';
/** 标签上下文的借据号/协议号：如 贷款借据号：811032383950/002、贷款协议号为811032383950002 */
const LABELED_RECEIPT_NO_RE = new RegExp(`(${RECEIPT_NO_LABEL}\\s*[:：是为]?\\s*)([0-9A-Za-z][0-9A-Za-z\\/\\-_]{7,29})`, 'g');
/** 附表表格行内的协议号/借据号单元格（身份证号已在前面步骤脱敏，行内剩余12-20位数字即协议号） */
const TABLE_RECEIPT_NO_RE = /(\|\s*)(\d{12,20}(?:\/\d{2,4})?)(?=\s*\|)/g;
/** 占位符包裹符（私有区字符，不会被后续脱敏规则命中） */
const PROTECT_WRAP = (i: number) => `\uE000${i}\uE001`;
const PROTECT_UNWRAP_RE = /\uE000(\d+)\uE001/g;
/**
 * 上下文引导的自然人姓名，支持顿号列举：
 * 「被告：谢添全、高俊胜、张立昕」整体命中并逐一脱敏
 * 注：边界不含冒号/分号，避免把「，身份证号：」等字段标签误判为人名
 */
const NAME_WORD = '(?:被告一|被告二|被告三|被告四|被告五|被告|原告一|原告二|原告三|原告|被告人|被申请人|申请人|被执行人|申请执行人|借款人|贷款人|保证人|抵押人|质押人|出质人|债务人|债权人|甲方|乙方|当事人|委托人|被保险人|投保人|姓名)';
const NAME_PART = '([\\u4e00-\\u9fa5]{2,4})';
const NAME_BOUND = '(?=[，。、！？,\\s（）()【】\\[\\]《》和与及等]|$)';
const NAME_CTX_RE = new RegExp(
  `(${NAME_WORD})\\s*[:：]\\s*${NAME_PART}${NAME_BOUND}((?:[、]\\s*${NAME_PART}${NAME_BOUND})*)`,
  'g'
);
/** 列举段内的单个姓名（捕获组1=分隔符，组2=姓名） */
const NAME_LIST_RE = /([、])\s*([\u4e00-\u9fa5]{2,4})/g;
/** 批量附表行「| 序号 | 案号(含 民初/民终/执) | 姓名 |」中的姓名单元格 */
const TABLE_NAME_RE = /(\|\s*\d+\s*\|\s*[^|]*\d{4}[^|]*民[初终执][^|]*\|\s*)([\u4e00-\u9fa5]{2,4})(\s*\|)/g;

function maskDigitsKeep(raw: string, keepHead: number, keepTail: number): string {
  if (raw.length <= keepHead + keepTail) return raw;
  return `${raw.slice(0, keepHead)}${'*'.repeat(raw.length - keepHead - keepTail)}${raw.slice(raw.length - keepTail)}`;
}

/**
 * 对文书全文执行脱敏
 * @returns 脱敏后的文本与脱敏处数（用于界面提示）
 */
export function desensitizeText(text: string): { text: string; count: number } {
  if (!text) return { text: text || '', count: 0 };
  let count = 0;

  let out = text;

  // 1. 18 位身份证号（保留前3后2）
  out = out.replace(ID18_RE, (m) => {
    count++;
    return maskDigitsKeep(m, 3, 2);
  });

  // 2. 15 位老身份证号
  out = out.replace(ID15_RE, (m) => {
    count++;
    return maskDigitsKeep(m, 3, 2);
  });

  // 3. 手机号（保留前3后4）
  out = out.replace(PHONE_RE, (m) => {
    count++;
    return maskDigitsKeep(m, 3, 4);
  });

  // 4. 上下文姓名（含顿号/逗号列举；含「某」视为已脱敏跳过）
  out = out.replace(NAME_CTX_RE, (full, prefix: string, first: string, rest: string) => {
    let replaced = 0;
    let firstName = first;
    if (!alreadyMasked(first)) {
      firstName = maskChineseName(first);
      replaced++;
    }
    const restStr = (rest || '').replace(NAME_LIST_RE, (_m: string, sep: string, n: string) => {
      if (alreadyMasked(n)) return sep + n;
      replaced++;
      return sep + maskChineseName(n);
    });
    if (replaced === 0) return full; // 全部已脱敏，保持原样（幂等）
    count += replaced;
    return `${prefix}：${firstName}${restStr}`;
  });

  // 5. 批量附表行姓名单元格
  out = out.replace(TABLE_NAME_RE, (full, head: string, name: string, tail: string) => {
    if (alreadyMasked(name)) return full;
    count++;
    return `${head}${maskChineseName(name)}${tail}`;
  });

  // 5.5 借据号/协议号保护（项目整体不脱敏）：先用占位符暂存，待长数字脱敏后原样还原
  const protectedSpans: string[] = [];
  const protectSpan = (num: string): string => {
    protectedSpans.push(num);
    return PROTECT_WRAP(protectedSpans.length - 1);
  };
  // a) 标签上下文：贷款借据号：811032383950/002、协议号: 811032383950002 等
  out = out.replace(LABELED_RECEIPT_NO_RE, (_m, label: string, num: string) => `${label}${protectSpan(num)}`);
  // b) 附表表格行单元格（| 分隔）：行内剩余12-20位数字即贷款协议号/借据号
  out = out.replace(TABLE_RECEIPT_NO_RE, (_m, pre: string, num: string) => `${pre}${protectSpan(num)}`);

  // 6. 银行卡号 / 贷款账号等长数字串（保留前4后3；置于身份证之后避免重复命中；借据号/协议号已保护跳过）
  out = out.replace(LONG_NUM_RE, (m) => {
    // 排除已被步骤 1/2 处理后残留的合规年份串（如 201812210000）误伤概率极低，统一按账号脱敏
    count++;
    return maskDigitsKeep(m, 4, 3);
  });

  // 还原借据号/协议号
  if (protectedSpans.length > 0) {
    out = out.replace(PROTECT_UNWRAP_RE, (_m, i: string) => protectedSpans[Number(i)]);
  }

  return { text: out, count };
}

/**
 * 对扣款回单等结构化 meta 中的敏感字段脱敏（返回新对象，不改动入参）
 */
export function desensitizeReceiptMeta<T extends { borrowerName?: string; idNumber?: string }>(meta: T): T {
  if (!meta) return meta;
  return {
    ...meta,
    borrowerName: meta.borrowerName ? maskChineseName(meta.borrowerName) : meta.borrowerName,
    idNumber: meta.idNumber ? maskIdNumber(meta.idNumber) : meta.idNumber,
  };
}
