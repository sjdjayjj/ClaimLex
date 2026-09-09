/**
 * 文本清洗与预处理工具模块
 * 针对裁判文书、金融借款合同 PDF 提取出的非结构化文本进行标准化治理
 */

export interface TextCleanResult {
  /** 清洗后的规范化文本 */
  cleanedText: string;
  /** 原始字符数 */
  originalLength: number;
  /** 清洗后字符数 */
  cleanedLength: number;
  /** 页眉页脚过滤条数 */
  filteredLinesCount: number;
  /** 文书基本特征检测（是否包含核心裁判文书关键词） */
  features: {
    hasCaseNo: boolean;
    hasJudgmentMain: boolean; // 是否有“裁判主文 / 判决如下”
    hasInterestTerms: boolean; // 是否包含利率/利息/LPR相关词
    estimatedPages: number;
  };
}

/**
 * 常见司法文书页眉页脚干扰词正则
 */
const NOISE_LINE_PATTERNS = [
  /^(?:中国裁判文书网|裁判文书公开平台|人民法院在线服务)/i,
  /^(?:第\s*\d+\s*页\s*[/共]\s*\d+\s*页)/i,
  /^(?:Page\s*\d+\s*(?:of|\/)\s*\d+)/i,
  /^\s*[-—]\s*\d+\s*[-—]\s*$/,
  /^\s*\d+\s*$/, // 单独的页码数字行
];

/**
 * 深度清洗裁判文书文本
 */
export function cleanDocumentText(rawText: string): TextCleanResult {
  if (!rawText) {
    return {
      cleanedText: '',
      originalLength: 0,
      cleanedLength: 0,
      filteredLinesCount: 0,
      features: {
        hasCaseNo: false,
        hasJudgmentMain: false,
        hasInterestTerms: false,
        estimatedPages: 1,
      },
    };
  }

  const originalLength = rawText.length;

  // 1. 过滤特殊零宽字符、不可见字符与替换字符
  let processed = rawText
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // 2. 逐行拆分，清理页眉页脚与无意义孤立行
  const lines = processed.split('\n');
  const cleanedLines: string[] = [];
  let filteredLinesCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 检查是否为页眉/页脚噪音
    const isNoise = NOISE_LINE_PATTERNS.some(p => p.test(trimmed));
    if (isNoise) {
      filteredLinesCount++;
      continue;
    }

    cleanedLines.push(trimmed);
  }

  let textJoined = cleanedLines.join('\n');

  // 3. 修复 PDF 常见中文字符间散落的无意义空格（例如 "本 金 2 0 0 万 元" -> "本金 200 万元"）
  // 仅压缩汉字与汉字之间的孤立空格，保留英文单词和数字与汉字之间的适当间距
  textJoined = textJoined.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
  textJoined = textJoined.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2'); // 多次消除连续空格

  // 4. 压缩超过连续两行的空行
  textJoined = textJoined.replace(/\n{3,}/g, '\n\n');

  // 5. 司法特征分析与提取
  const hasCaseNo = /（\d{4}）[\u4e00-\u9fa5]{1,4}\d{1,6}号|\(\d{4}\)[\u4e00-\u9fa5]{1,4}\d{1,6}号/.test(textJoined);
  const hasJudgmentMain = /判决如下|裁判结果|主文如下|裁定如下|协议如下|调解协议/.test(textJoined);
  const hasInterestTerms = /LPR|利率|罚息|复利|借款|加收|基准|迟延履行/.test(textJoined);

  return {
    cleanedText: textJoined.trim(),
    originalLength,
    cleanedLength: textJoined.length,
    filteredLinesCount,
    features: {
      hasCaseNo,
      hasJudgmentMain,
      hasInterestTerms,
      estimatedPages: Math.max(1, Math.ceil(textJoined.length / 1000)),
    },
  };
}
