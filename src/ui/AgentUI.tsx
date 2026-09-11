import React, { useState, useRef, useEffect } from 'react';
import { InterestCalculator, roundToFen } from '../core/calculator';
import { CalculationParams, CalculationResult, RepaymentRecord, RepaymentReceiptMeta } from '../core/types';
import { RATE_HISTORY } from '../core/rates';
import { extractTextFromPDF } from '../parser/pdfUtil';
import { cleanDocumentText } from '../parser/textCleaner';
import { exportToExcel } from '../core/exportUtil';
import { LLMConfigModal } from './LLMConfigModal';
import { LLMConfig, ParsedAnalysisResult, BatchCaseClient } from '../services/llmTypes';
import { loadLLMConfig, analyzeJudgmentWithLLM } from '../services/llmService';
import { parseRepaymentReceiptFromText, SAMPLE_REPAYMENT_RECEIPT, normalizeDate } from '../parser/repaymentReceiptParser';
import dayjs from 'dayjs';
import { 
  FileUp, 
  Loader2, 
  CheckCircle2, 
  Download, 
  Bot, 
  Sparkles, 
  Scale, 
  FileText, 
  Printer, 
  ShieldCheck, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  ArrowDownCircle,
  Database,
  Settings2,
  KeyRound,
  Code2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  Users,
  UserCheck,
  Search,
  Building2,
  Layers,
  Receipt,
  CheckSquare,
  Square,
  Filter,
  Trash2,
  PlusCircle,
  CreditCard
} from 'lucide-react';

const SAMPLE_JUDGMENT = `【民事判决书摘录（广东省高级人民法院典型金融借贷案例）】
案号：（2023）粤民终1268号
原告：某某商业银行股份有限公司广州分行
被告：某某现代供应链管理有限公司、赵某某、钱某某

【法院查明事实】：
原告与被告于2020年6月15日签署编号为《GR-2020-0615》的《流动资金借款合同》，约定借款本金为人民币2,000,000.00元整。借款利率采用浮动利率定价方式，以借款发放日前一工作日全国银行间同业拆借中心公布的5年期以上LPR为定价基准，加60个基点（BP）执行（即按 LPR + 0.60% 计息）。
借款人违约逾期的，贷款人有权对逾期本金自逾期之日起按借款合同约定利率加收50%计收罚息（即执行罚息倍数1.5倍）；对借款人未按时支付的正常利息及罚息，按前述执行罚息利率按月计收复利。
合同履行中，借款人发生重大违约，原告依约宣布贷款提前到期。截至2023年1月1日（债权确认基准日），被告尚欠原告本金人民币2,000,000.00元，欠付正常利息56,000.00元，逾期罚息及复利8,200.00元。

【裁判主文如下】：
一、被告某某现代供应链管理有限公司于本判决生效之日起十日内向原告偿还借款本金2,000,000.00元，并支付截至2023年1月1日的欠息56,000.00元、罚复利8,200.00元；
二、被告某某现代供应链管理有限公司自2023年1月2日起至实际清偿之日止，以本金2,000,000.00元为基数，按全国银行间同业拆借中心公布的5年期以上LPR加60个基点上浮50%计算逾期罚息；并以未付正常利息与未付罚息为基数，按前述罚息利率计付复利；
三、如果未按本判决指定的期间履行给付金钱义务，应当依照《中华人民共和国民事诉讼法》第二百六十四条之规定，加倍支付迟延履行期间的债务利息（日万分之一点七五）；
四、被告赵某某、钱某某对上述债务承担连带清偿责任。`;

const SAMPLE_BATCH_JUDGMENT = `【民事判决书摘录（深圳市福田区人民法院金融借款批量诉讼系列案）】
案号：（2022）粤0304民初21154号等系列案
原告：某某消费金融股份有限公司
被告：谢添全、高俊胜、张立昕、钟良枢、朱乐冬、贺伟等借款人

【裁判查明与认定事实】：
原告某某消费金融公司与各被告在线分别签署《个人消费贷款授信合同》，约定贷款利率按借款发放日全国银行间同业拆借中心公布的1年期LPR执行并加收相应基点。借款人违约逾期的，自违约之日起按原借款执行利率的1.5倍加计逾期罚息；未按时支付的正常利息及罚息按前述罚息利率计收复利。
原告向本院提起批量给付之诉。经本院审理查明各被告截至指定截息日的尚欠借款本金及利息罚息明细，并制定《附表一 原告诉讼请求附表》。

附表一 原告诉讼请求附表 金额单位：元
| 序号 | 案号 | 被告 | 性别 | 民族 | 身份证号码 | 身份证地址 | 本金余额 | 利息 | 罚息 | 复利 | 截息日期 | 案件受理费 | 保全费 |
| 1 | (2022)粤0304民初21154号 | 谢添全 | 男 | 汉族 | 440981198803294918 | 广东省高州市东岸镇射坡大辟村30号 | 104869.00 | 0 | 17531.75 | 1379.15 | 2020-11-2 | 2775.60 | 1138.89 |
| 2 | (2022)粤0304民初21157号 | 高俊胜 | 男 | 汉族 | 440106196609281897 | 广东省深圳市福田区国城花园2栋3107 | 300000.00 | 20338.27 | 28798.00 | 3976.47 | 2020-11-2 | 6596.70 | / |
| 3 | (2022)粤0304民初21158号 | 张立昕 | 男 | 汉族 | 429001198501194835 | 湖北省随县小林镇小林店居委会十五组 | 68100.00 | 2264.29 | 5738.70 | 447.81 | 2020-11-2 | 1713.78 | 785.50 |
| 4 | (2022)粤0304民初21160号 | 钟良枢 | 男 | 汉族 | 441424196808223294 | 广东省五华县岐岭镇龙水村松二 | 62300.00 | 4169.07 | 8020.02 | 1164.18 | 2020-11-2 | 1691.34 | / |
| 5 | (2022)粤0304民初21164号 | 朱乐冬 | 男 | 汉族 | 420603197811081038 | 广东省深圳市罗湖区东门南路1021号阳光新干线家园A座903 | 130315.08 | 0 | 14931.64 | 817.01 | 2021-2-4 | 3221.28 | 1250.31 |
| 6 | (2022)粤0304民初21165号 | 贺伟 | 男 | 汉族 | 413023198209086416 | 河南省信阳市浉河区董家河乡教育路318号 | 227800.00 | 6195.16 | 13357.46 | 783.81 | 2020-11-2 | 5022.04 | / |

【判决主文】：
一、各被告应于本判决生效之日起十日内向原告偿还附表一所列尚欠借款本金，并支付截至附表所列截息日期的利息、罚息及复利；
二、各被告自附表所列截息日期次日起至实际清偿之日止，以本金余额为基数，按同期全国银行间同业拆借中心公布的1年期LPR加60个基点上浮50%计算逾期罚息，并按上述罚息利率计付复利；
三、依照《中华人民共和国民事诉讼法》第二百六十四条之规定，加倍支付迟延履行期间的债务利息（日万分之一点七五）；
四、各被告承担附表一所列诉讼费与保全费。`;

export const SAMPLE_BATCH_CLIENTS: BatchCaseClient[] = [
  {
    id: '1',
    caseNo: '(2022)粤0304民初21154号',
    defendant: '谢添全',
    gender: '男',
    nation: '汉族',
    idCard: '440981198803294918',
    idAddress: '广东省高州市东岸镇射坡大辟村30号',
    principal: 104869.00,
    baseInterest: 0,
    basePenalty: 17531.75,
    baseCompound: 1379.15,
    cutoffDate: '2020-11-02',
    litigationFee: 2775.60,
    preservationFee: 1138.89,
  },
  {
    id: '2',
    caseNo: '(2022)粤0304民初21157号',
    defendant: '高俊胜',
    gender: '男',
    nation: '汉族',
    idCard: '440106196609281897',
    idAddress: '广东省深圳市福田区国城花园2栋3107',
    principal: 300000.00,
    baseInterest: 20338.27,
    basePenalty: 28798.00,
    baseCompound: 3976.47,
    cutoffDate: '2020-11-02',
    litigationFee: 6596.70,
    preservationFee: 0,
  },
  {
    id: '3',
    caseNo: '(2022)粤0304民初21158号',
    defendant: '张立昕',
    gender: '男',
    nation: '汉族',
    idCard: '429001198501194835',
    idAddress: '湖北省随县小林镇小林店居委会十五组',
    principal: 68100.00,
    baseInterest: 2264.29,
    basePenalty: 5738.70,
    baseCompound: 447.81,
    cutoffDate: '2020-11-02',
    litigationFee: 1713.78,
    preservationFee: 785.50,
  },
  {
    id: '4',
    caseNo: '(2022)粤0304民初21160号',
    defendant: '钟良枢',
    gender: '男',
    nation: '汉族',
    idCard: '441424196808223294',
    idAddress: '广东省五华县岐岭镇龙水村松二',
    principal: 62300.00,
    baseInterest: 4169.07,
    basePenalty: 8020.02,
    baseCompound: 1164.18,
    cutoffDate: '2020-11-02',
    litigationFee: 1691.34,
    preservationFee: 0,
  },
  {
    id: '5',
    caseNo: '(2022)粤0304民初21164号',
    defendant: '朱乐冬',
    gender: '男',
    nation: '汉族',
    idCard: '420603197811081038',
    idAddress: '广东省深圳市罗湖区东门南路1021号阳光新干线家园A座903',
    principal: 130315.08,
    baseInterest: 0,
    basePenalty: 14931.64,
    baseCompound: 817.01,
    cutoffDate: '2021-02-04',
    litigationFee: 3221.28,
    preservationFee: 1250.31,
  },
  {
    id: '6',
    caseNo: '(2022)粤0304民初21159号',
    defendant: '贺伟',
    gender: '男',
    nation: '汉族',
    idCard: '420621198506197519',
    idAddress: '湖北省襄阳市襄州区黄集镇毛营村六组25号',
    principal: 200000.00,
    baseInterest: 0,
    basePenalty: 13357.46,
    baseCompound: 783.81,
    cutoffDate: '2020-11-02',
    litigationFee: 5022.04,
    preservationFee: 0,
  },
];

/**
 * 统一金额格式化：严格精确到分位（保留且仅保留2位小数，千分位，绝无3位小数）
 */
export const formatMoney = (val?: number | null): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0.00';
  const num = roundToFen(Number(val));
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const AgentUI: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'agent' | 'rates' | 'guide'>('agent');
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgressText, setParseProgressText] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractStats, setExtractStats] = useState<{ pages: number; chars: number; filtered: number } | null>(null);
  const [scannedWarning, setScannedWarning] = useState(false);
  
  // 大模型与解析状态
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(loadLLMConfig);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ParsedAnalysisResult | null>(null);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 批量案件多客户选择与检索状态
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearchKeyword, setClientSearchKeyword] = useState<string>('');

  // 银行扣款明细 / 还款流水状态 (支持多笔勾选参与算息)
  const [repayments, setRepayments] = useState<RepaymentRecord[]>([]);
  const [receiptMeta, setReceiptMeta] = useState<RepaymentReceiptMeta | null>(null);
  const [isRepaymentSectionOpen, setIsRepaymentSectionOpen] = useState<boolean>(true);
  const repaymentFileInputRef = useRef<HTMLInputElement>(null);

  // 计算引擎状态
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [params, setParams] = useState<CalculationParams | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 客户列表实时过滤
  const filteredClients = (analysisResult?.batchClients || []).filter(c => {
    if (!clientSearchKeyword.trim()) return true;
    const kw = clientSearchKeyword.trim().toLowerCase();
    return (
      c.defendant?.toLowerCase().includes(kw) ||
      c.caseNo?.toLowerCase().includes(kw) ||
      c.idCard?.toLowerCase().includes(kw) ||
      c.id === kw
    );
  });

  // 触发核心热重算
  const triggerRecalculate = (targetParams: CalculationParams, targetRepayments?: RepaymentRecord[]) => {
    const activeRepayments = targetRepayments !== undefined ? targetRepayments : repayments;
    const finalParams: CalculationParams = {
      ...targetParams,
      repayments: activeRepayments,
    };
    setParams(finalParams);
    try {
      const calculator = new InterestCalculator();
      const calcResult = calculator.calculate(finalParams);
      setResult(calcResult);
    } catch (err) {
      console.error('利息计算执行异常:', err);
    }
  };

  // 单独上传银行扣款明细 / 还款回单 PDF
  const handleRepaymentPdfUpload = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('请上传 PDF 格式的银行扣款回单或还款流水清单');
      return;
    }
    setIsUploading(true);
    setParseProgressText('正在读取并提取银行扣款回单 PDF 表格流水...');
    try {
      const extractRes = await extractTextFromPDF(file);
      const parsedReceipt = parseRepaymentReceiptFromText(extractRes.text);
      if (parsedReceipt.records.length === 0) {
        alert('未在上传的 PDF 中探测到格式化扣款明细流水，请核对是否为包含流水号与扣款金额的回单');
        return;
      }

      setReceiptMeta(parsedReceipt.meta);
      const baseDate = params?.baseDate || parsedReceipt.meta.loanDueDate || '2019-12-10';
      const initializedRecords = parsedReceipt.records.map(r => ({
        ...r,
        selected: dayjs(r.date).isAfter(dayjs(baseDate)),
      }));
      setRepayments(initializedRecords);

      const currentParams: CalculationParams = params || {
        baseDate,
        endDate: dayjs().format('YYYY-MM-DD'),
        principal: parsedReceipt.meta.loanAmount || 258700,
        baseInterest: 0,
        basePenalty: 0,
        rateMode: 'LPR',
        lprTerm: '1Y',
        lprBp: 0,
        lprFloatRatio: 0,
        penaltyMultiple: 1.5,
        compoundMode: 'INT_AND_PENALTY',
        delayInterestEnabled: true,
      };

      if (!analysisResult) {
        setAnalysisResult({
          params: currentParams,
          caseNo: parsedReceipt.meta.loanReceiptNo ? `借据:${parsedReceipt.meta.loanReceiptNo}` : '银行扣款回单测算',
          plaintiff: parsedReceipt.meta.loanOrg || '深圳高新区支行',
          defendant: parsedReceipt.meta.borrowerName || '借款人',
          reasoning: `【银行扣款流水已提取】：共导入 ${initializedRecords.length} 笔扣款流水，累计还款 ￥${formatMoney(parsedReceipt.totalRepaidSum)} 元。系统已自动按基准日（${baseDate}）智能匹配判决后生效抵扣流水，并切入分段利息冲减模型。`,
          keyPoints: [
            `成功提取贷款借据：${parsedReceipt.meta.loanReceiptNo || '未指定'}，借款金额 ￥${formatMoney(parsedReceipt.meta.loanAmount)}`,
            `共解析出 ${initializedRecords.length} 笔流水，基准日后还款将自动冲减计息本金`,
            '支持在还款明细表中自由勾选或排除任一还款项进行敏感性测算'
          ],
          repayments: initializedRecords,
          receiptMeta: parsedReceipt.meta,
        });
      }

      triggerRecalculate(currentParams, initializedRecords);
    } catch (err: any) {
      console.error('扣款回单解析失败:', err);
      alert(`扣款回单解析失败: ${err.message || '文件格式异常'}`);
    } finally {
      setIsUploading(false);
      setParseProgressText('');
    }
  };

  // 载入真实扣款回单样例（对应深圳高新区支行 秦*英 258,700 元贷款扣款回单）
  const handleLoadSampleReceipt = () => {
    setReceiptMeta(SAMPLE_REPAYMENT_RECEIPT.meta);
    const baseDate = params?.baseDate || '2019-12-10';
    const sampleRecords = SAMPLE_REPAYMENT_RECEIPT.records.map(r => ({
      ...r,
      selected: dayjs(r.date).isAfter(dayjs(baseDate)),
    }));
    setRepayments(sampleRecords);

    const currentParams: CalculationParams = params || {
      baseDate: '2019-12-10',
      endDate: dayjs().format('YYYY-MM-DD'),
      principal: 258700.00,
      baseInterest: 0,
      basePenalty: 0,
      rateMode: 'LPR',
      lprTerm: '1Y',
      lprBp: 0,
      lprFloatRatio: 0,
      penaltyMultiple: 1.5,
      compoundMode: 'INT_AND_PENALTY',
      delayInterestEnabled: true,
    };

    if (!analysisResult) {
      setAnalysisResult({
        params: currentParams,
        caseNo: '(2020)粤0305民初11892号 (借据: 811032260373/001)',
        plaintiff: '某某商业银行深圳高新区支行',
        defendant: '秦*英',
        reasoning: '【个人贷款扣款回单审查结论】：借据号 811032260373/001，贷款到期日 2019-12-10，尚欠本金 258,700 元。到期后借款人陆续发生多次还款（共计提取 21 笔扣款明细）。系统已自动识别并勾选基准日（2019-12-10）之后的还款流水，用于分段冲减计息本金并核减最终债权。',
        keyPoints: [
          '提取到借款人秦*英全套 21 笔扣款流水，累计还款总额 ￥292,443.53',
          '2019-12-10 判决/到期基准日后的还款（如2020年及2025年回款）已自动计入动态冲减',
          '每一笔归还本金均在对应分段起始日扣减计息基数，精准遏制虚增罚息'
        ],
        repayments: sampleRecords,
        receiptMeta: SAMPLE_REPAYMENT_RECEIPT.meta,
      });
    }

    triggerRecalculate(currentParams, sampleRecords);
  };

  // 单笔还款切换勾选
  const handleToggleRepayment = (id: string) => {
    const updated = repayments.map(r => r.id === id ? { ...r, selected: !r.selected } : r);
    setRepayments(updated);
    if (params) {
      triggerRecalculate(params, updated);
    }
  };

  // 批量全选 / 全不选还款
  const handleSelectAllRepayments = (selected: boolean) => {
    const updated = repayments.map(r => ({ ...r, selected }));
    setRepayments(updated);
    if (params) {
      triggerRecalculate(params, updated);
    }
  };

  // 仅选基准日后的还款
  const handleSelectAfterBaseDate = () => {
    const baseDate = params?.baseDate || '2019-12-10';
    const updated = repayments.map(r => ({
      ...r,
      selected: dayjs(r.date).isAfter(dayjs(baseDate)),
    }));
    setRepayments(updated);
    if (params) {
      triggerRecalculate(params, updated);
    }
  };

  // 清空扣款流水
  const handleClearRepayments = () => {
    setRepayments([]);
    setReceiptMeta(null);
    if (params) {
      triggerRecalculate(params, []);
    }
  };

  // 初始化加载配置
  useEffect(() => {
    setLlmConfig(loadLLMConfig());
  }, []);

  // 文件拖拽与上传，调用增强型 PDF 提取与清洗模块
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('请上传 PDF 格式的裁判文书或合同文本');
      return;
    }

    setIsUploading(true);
    setUploadedFileName(file.name);
    setScannedWarning(false);
    setErrorMessage(null);

    try {
      const extractRes = await extractTextFromPDF(file, {
        onProgress: (cur, total) => {
          setParseProgressText(`正在提取 PDF 文本：第 ${cur} / ${total} 页...`);
        },
      });

      setInputText(extractRes.text);
      setExtractStats({
        pages: extractRes.totalPages,
        chars: extractRes.cleanResult.cleanedLength,
        filtered: extractRes.cleanResult.filteredLinesCount,
      });

      // 智能探测是否同时包含银行贷款扣款明细回单
      if (extractRes.text.includes('个人贷款扣款回单') || extractRes.text.includes('交易流水号') || extractRes.text.includes('归还本金')) {
        const parsedReceipt = parseRepaymentReceiptFromText(extractRes.text);
        if (parsedReceipt.records.length > 0) {
          setReceiptMeta(parsedReceipt.meta);
          const baseDate = params?.baseDate || parsedReceipt.meta.loanDueDate || '2019-12-10';
          const recs = parsedReceipt.records.map(r => ({
            ...r,
            selected: dayjs(r.date).isAfter(dayjs(baseDate)),
          }));
          setRepayments(recs);
        }
      }

      if (extractRes.isScannedWarning) {
        setScannedWarning(true);
      }
    } catch (error: any) {
      console.error('PDF 解析失败:', error);
      setErrorMessage(`PDF 解析异常：${error.message || '文件读取错误'}`);
    } finally {
      setIsUploading(false);
      setParseProgressText('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const loadSample = () => {
    setUploadedFileName('粤民终1268号民事判决书_单一案件样本.pdf');
    setInputText(SAMPLE_JUDGMENT);
    setScannedWarning(false);
    setErrorMessage(null);
    setExtractStats(null);
    setSelectedClientId(null);
  };

  // 载入典型的批量案件附表样例（深圳福田消金批量诉讼系列案）
  const loadBatchSample = () => {
    setUploadedFileName('深圳福田消金系列案_附表一原告诉讼请求附表.pdf');
    setInputText(SAMPLE_BATCH_JUDGMENT);
    setScannedWarning(false);
    setErrorMessage(null);
    setExtractStats(null);

    // 预置解析状态
    const firstClient = SAMPLE_BATCH_CLIENTS[0];
    setSelectedClientId(firstClient.id);

    const initialBatchParams: CalculationParams = {
      baseDate: firstClient.cutoffDate || '2020-11-02',
      endDate: dayjs().format('YYYY-MM-DD'),
      principal: firstClient.principal,
      baseInterest: firstClient.baseInterest,
      basePenalty: firstClient.basePenalty,
      rateMode: 'LPR',
      lprTerm: '1Y',
      lprBp: 60,
      lprFloatRatio: 0,
      penaltyMultiple: 1.5,
      compoundMode: 'INT_AND_PENALTY',
      delayInterestEnabled: true,
    };

    const mockAnalysis: ParsedAnalysisResult = {
      params: initialBatchParams,
      caseNo: firstClient.caseNo,
      plaintiff: '某某消费金融股份有限公司',
      defendant: `${firstClient.defendant} (附表第1位客户)`,
      reasoning: '【批量案件司法审查结论】：本案系某某消费金融公司诉多名借款人的消费信贷批量系列案。判决以《附表一 原告诉讼请求附表》形式分别载明了各被告姓名、案号、身份证、尚欠本金及利息罚息。判令以各被告截至指定截息日（如2020-11-02）的本金为基数，按1年期LPR加60BP上浮50%计算罚复利至清偿日，并加倍支付迟延履行金。',
      keyPoints: [
        `共提取到附表内 ${SAMPLE_BATCH_CLIENTS.length} 位借款人清单（含谢添全、高俊胜、张立昕、钟良枢、朱乐冬、贺伟等）`,
        '各借款人分别设立独立子案号，本金与暂计罚息独立测算',
        '支持在下方【批量案件客户选择器】中自由点击切换指定客户进行独立清算与证据生成'
      ],
      isBatchCase: true,
      batchClients: SAMPLE_BATCH_CLIENTS,
      selectedClientId: firstClient.id,
      rawOutput: JSON.stringify({
        isBatchCase: true,
        batchClients: SAMPLE_BATCH_CLIENTS,
        note: '样例已自动组装 6 名客户附表明细'
      }, null, 2),
    };

    setAnalysisResult(mockAnalysis);
    setParams(initialBatchParams);

    const calculator = new InterestCalculator();
    const calcResult = calculator.calculate(initialBatchParams);
    setResult(calcResult);
  };

  // 用户在批量列表中切换选定特定客户并立即重算
  const handleSelectClient = (client: BatchCaseClient) => {
    setSelectedClientId(client.id);

    if (!analysisResult) return;

    // 依据选定客户重构计算参数（严格精确到分位）
    const currentParams = params || analysisResult.params;
    const updatedParams: CalculationParams = {
      ...currentParams,
      principal: roundToFen(client.principal),
      baseInterest: roundToFen(client.baseInterest),
      basePenalty: roundToFen(client.basePenalty),
      baseDate: client.cutoffDate || currentParams.baseDate,
    };

    // 更新文书显示的原被告与案号
    setAnalysisResult({
      ...analysisResult,
      caseNo: client.caseNo || analysisResult.caseNo,
      defendant: `${client.defendant} (附表序号 ${client.id})`,
      selectedClientId: client.id,
    });

    setParams(updatedParams);

    // 立即执行确定性精算
    try {
      const calculator = new InterestCalculator();
      const calcRes = calculator.calculate(updatedParams);
      setResult(calcRes);
    } catch (err) {
      console.error('切换客户重算异常:', err);
    }
  };

  // Agent 核心触发逻辑：调用真实大模型接口
  const handleExecuteAgent = async () => {
    if (!inputText.trim()) return;

    // 检查 API Key 是否配置
    if (!llmConfig.apiKey || !llmConfig.apiKey.trim()) {
      setIsConfigOpen(true);
      setErrorMessage('未检测到 API Key，请先录入您的大模型 API 密钥以启用真实 AI 分析');
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);
    setParseProgressText('初始化大模型客户端...');

    try {
      // 1. 调用真实大模型完成文书解析与要素提取
      const parsedData = await analyzeJudgmentWithLLM(inputText, llmConfig, (statusText) => {
        setParseProgressText(statusText);
      });

      setAnalysisResult(parsedData);
      setParams(parsedData.params);

      // 若包含还款流水，同步填充状态
      if (parsedData.repayments && parsedData.repayments.length > 0) {
        setRepayments(parsedData.repayments);
      }
      if (parsedData.receiptMeta) {
        setReceiptMeta(parsedData.receiptMeta);
      }

      // 若识别出批量客户，默认选中第 1 位客户
      if (parsedData.batchClients && parsedData.batchClients.length > 0) {
        setSelectedClientId(parsedData.batchClients[0].id);
      } else {
        setSelectedClientId(null);
      }

      // 2. 调度确定性高精算法进行清算
      const calculator = new InterestCalculator();
      const calcResult = calculator.calculate(parsedData.params);
      setResult(calcResult);
    } catch (err: any) {
      console.error('大模型解析调用失败:', err);
      setErrorMessage(err.message || '大模型调用异常，请检查网络或配置');
    } finally {
      setIsParsing(false);
      setParseProgressText('');
    }
  };

  // 人机协同交互：支持微调任何参数并实时热重算
  const handleParamChange = (field: keyof CalculationParams, value: any) => {
    if (!params) return;
    let cleanVal = value;
    if (['principal', 'baseInterest', 'basePenalty'].includes(field)) {
      cleanVal = roundToFen(Number(value) || 0);
    }
    const updated = { ...params, [field]: cleanVal };
    triggerRecalculate(updated);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* 顶部现代化控制台 Header */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border border-blue-800/40 p-6 sm:p-8 shadow-2xl">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <Sparkles className="w-3.5 h-3.5" /> 金融司法裁判智能解纷系统
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  <Bot className="w-3.5 h-3.5" /> 真实 LLM 语义要素提取
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 司法级 0 误差清算中枢
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Scale className="w-8 h-8 text-blue-400" />
                基于大模型 Agent 的金融借贷纠纷智能裁判与债权清算助理
              </h1>

              <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
                直击特资清收与法务诉讼重灾痛点：通过大模型深度理解非结构化文书要素，结合司法级利息算法执行 2000 至今基准/LPR 浮动利率跨期清算，一键生成法庭质证标准的制式证据底稿。
              </p>
            </div>

            {/* 顶栏操作区：配置模型与打印 */}
            <div className="flex flex-wrap items-center gap-3 self-stretch lg:self-auto justify-end">
              {/* 大模型配置入口按钮 */}
              <button
                onClick={() => setIsConfigOpen(true)}
                className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all shadow-lg ${
                  !llmConfig.apiKey
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 animate-pulse'
                    : 'bg-slate-800/90 border-slate-700/80 text-slate-200 hover:bg-slate-700'
                }`}
                title="配置大模型 API 地址、密钥及参数"
              >
                <Settings2 className="w-4 h-4 text-blue-400" />
                <span>模型: {llmConfig.model || '未设置'}</span>
                {!llmConfig.apiKey ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400 text-slate-950 font-bold">
                    需配置 Key
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 shadow-lg transition-all"
              >
                <Printer className="w-4 h-4 text-slate-400" /> 打印底稿
              </button>
            </div>
          </div>

          {/* 导航 Tab */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setActiveTab('agent')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'agent'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Bot className="w-4 h-4" /> AI Agent 智能解纷主控台
            </button>
            <button
              onClick={() => setActiveTab('rates')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'rates'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Database className="w-4 h-4" /> 利率数据中心 (2000-2026)
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'guide'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <HelpCircle className="w-4 h-4" /> 司法裁判规则说明
            </button>
          </div>
        </header>

        {/* 异常错误提示卡片 */}
        {errorMessage && (
          <div className="rounded-xl p-4 bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-3 shadow-lg animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="font-bold text-sm text-red-300">执行或配置提示</div>
              <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                {errorMessage}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsConfigOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-white font-medium transition border border-red-700/60"
              >
                配置大模型
              </button>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-400 hover:text-red-200 p-1"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ---------------- 视图 1：Agent 主控台 ---------------- */}
        {activeTab === 'agent' && (
          <div className="space-y-6">

            {/* 步骤 1：文书感知与输入 */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl backdrop-blur-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/30">
                    1
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      裁判文书/借款合同感知层
                      <span className="text-xs font-normal text-slate-400">（支持上传 PDF 自动清洗或直接输入正文）</span>
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={loadSample}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all shadow-sm"
                    title="载入普通单一案件判决书示例"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" /> 单一案件样例
                  </button>

                  <button
                    onClick={loadBatchSample}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-700/60 hover:bg-blue-900/80 transition-all shadow-sm"
                    title="载入包含《原告诉讼请求附表》的批量案件裁判文书示例（含多位借款人）"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" /> 载入批量案件附表样例 (消金系列案)
                  </button>

                  <button
                    onClick={handleLoadSampleReceipt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/80 transition-all shadow-sm"
                    title="载入银行个人贷款扣款回单明细流水示例（秦*英 25.87万元借款扣款表）"
                  >
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" /> 载入扣款回单流水样例
                  </button>

                  <input
                    type="file"
                    ref={repaymentFileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleRepaymentPdfUpload(e.target.files[0])}
                    accept=".pdf"
                    className="hidden"
                  />
                  <button
                    onClick={() => repaymentFileInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60 transition-all shadow-sm"
                    title="独立上传并提取行内《个人贷款扣款回单》PDF 表格流水"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" /> 导入扣款明细 (PDF)
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    accept=".pdf"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/20 transition-all"
                  >
                    {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                    {isUploading ? '正在深度解析 PDF...' : '上传裁判文书 (PDF)'}
                  </button>
                </div>
              </div>

              {/* 扫描件提示 */}
              {scannedWarning && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    提示：该 PDF 提取到的文本量极少，可能为<strong>纯图片扫描件</strong>。若解析不全，建议使用已 OCR 的文档或直接粘贴文书正文。
                  </span>
                </div>
              )}

              {/* 拖拽/粘贴文本区 */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="relative group rounded-xl border-2 border-dashed border-slate-700/80 hover:border-blue-500/60 transition-colors bg-slate-950/60 p-1"
              >
                <textarea
                  className="w-full h-44 p-4 bg-transparent text-slate-200 text-sm leading-relaxed placeholder-slate-500 focus:outline-none resize-y font-mono"
                  placeholder="可将判决书 PDF 文件直接拖拽到此处，或粘贴借款合同文本、民事起诉状、判决主文..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />

                <div className="flex flex-wrap justify-between items-center px-4 py-2 bg-slate-900/80 rounded-b-lg border-t border-slate-800 text-xs text-slate-400 gap-2">
                  <div className="flex items-center gap-3">
                    {uploadedFileName ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 已加载：{uploadedFileName}
                      </span>
                    ) : (
                      <span>字符数：{inputText.length}</span>
                    )}
                    {extractStats && (
                      <span className="text-slate-500 text-[11px]">
                        (共 {extractStats.pages} 页，过滤杂质噪音 {extractStats.filtered} 行)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <span>当前调用模型：<span className="font-mono text-blue-300">{llmConfig.model}</span></span>
                    <span>｜</span>
                    <span>计息标准：实际天数 ÷ 360</span>
                  </div>
                </div>
              </div>

              {/* 启动 Agent 执行按钮 */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                <div className="text-xs text-slate-400">
                  {isParsing && (
                    <div className="flex items-center gap-2 text-blue-400 animate-pulse font-mono">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{parseProgressText || '正在调度大模型与司法解析引擎...'}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExecuteAgent}
                    disabled={isParsing || !inputText.trim()}
                    className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm text-white shadow-xl transition-all ${
                      isParsing || !inputText.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 shadow-blue-600/30 hover:shadow-blue-500/50 hover:scale-[1.01] active:scale-[0.99]'
                    }`}
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>正在进行真实 LLM 推理与清算...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300 animate-bounce" />
                        <span>⚡ 启动真实大模型智能解析与债权清算</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 步骤 2：大模型司法分析报告与要素结构化展示 */}
            {analysisResult && (
              <div className="rounded-2xl bg-slate-900/90 border border-indigo-950/60 p-6 shadow-xl backdrop-blur-sm space-y-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm border border-indigo-500/30">
                      2
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        大模型司法文书结构化研判报告
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          {llmConfig.model} 提取与论证
                        </span>
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {analysisResult.rawOutput && (
                      <button
                        onClick={() => setShowRawOutput(!showRawOutput)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      >
                        <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                        {showRawOutput ? '收起模型原文' : '查看模型原始响应'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 核心文书元信息（案号、原被告） */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <div className="text-[11px] text-slate-400">判决案号</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {analysisResult.caseNo || '未识别案号 / 非涉诉文书'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <div className="text-[11px] text-slate-400">原告 / 债权人</div>
                    <div className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
                      {analysisResult.plaintiff || '文书未明确'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                    <div className="text-[11px] text-slate-400">被告 / 债务人</div>
                    <div className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
                      {analysisResult.defendant || '文书未明确'}
                    </div>
                  </div>
                </div>

                {/* 司法论证与判决逻辑 */}
                <div className="p-4 bg-indigo-950/20 rounded-xl border border-indigo-800/40 space-y-2">
                  <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    【大模型裁判事实与法律逻辑审查结论】：
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {analysisResult.reasoning}
                  </p>

                  {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
                    <div className="pt-2 border-t border-indigo-900/40 space-y-1">
                      <div className="text-[11px] text-indigo-400 font-semibold">提取要点提炼：</div>
                      <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                        {analysisResult.keyPoints.map((pt, idx) => (
                          <li key={idx}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 大模型原始 JSON 输出折叠查看 */}
                {showRawOutput && analysisResult.rawOutput && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="text-[11px] text-slate-400 flex justify-between items-center">
                      <span>大模型完整响应文本 (Raw Output):</span>
                      <span className="text-[10px] text-slate-500">用于法务核验审计</span>
                    </div>
                    <pre className="p-3 bg-slate-900/90 rounded-lg text-slate-300 text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {analysisResult.rawOutput}
                    </pre>
                  </div>
                )}

                {/* 批量案件客户附表明细与靶向选择器（供用户按需挑选特定客户计算） */}
                {analysisResult.batchClients && analysisResult.batchClients.length > 0 && (
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-400" />
                          <span>批量案件借款人客户附表明细与靶向选择器</span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50 font-mono">
                            共识别到 {analysisResult.batchClients.length} 位客户
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          系统当前正在清算客户：
                          <span className="text-amber-300 font-bold ml-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                            {analysisResult.batchClients.find(c => c.id === selectedClientId)?.defendant || analysisResult.defendant}
                          </span>
                          <span className="text-slate-400 ml-2 font-mono">
                            (案号: {analysisResult.batchClients.find(c => c.id === selectedClientId)?.caseNo || analysisResult.caseNo})
                          </span>
                          <span className="text-slate-500 ml-2 text-[11px]">点击任一客户即可一键切换精准清算与生成质证清单</span>
                        </div>
                      </div>

                      {/* 快捷搜索过滤 */}
                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={clientSearchKeyword}
                          onChange={(e) => setClientSearchKeyword(e.target.value)}
                          placeholder="搜索姓名、身份证、案号..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                    </div>

                    {/* 客户列表表格 */}
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 max-h-80 overflow-y-auto shadow-inner">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/95 text-slate-400 border-b border-slate-800 text-[11px] sticky top-0 z-10 backdrop-blur-sm">
                          <tr>
                            <th className="px-3.5 py-2.5 text-center">状态</th>
                            <th className="px-3.5 py-2.5">序号</th>
                            <th className="px-3.5 py-2.5">对应子案号</th>
                            <th className="px-3.5 py-2.5">被告姓名</th>
                            <th className="px-3.5 py-2.5">身份证号码</th>
                            <th className="px-3.5 py-2.5">身份证地址</th>
                            <th className="px-3.5 py-2.5 text-right">尚欠本金 (元)</th>
                            <th className="px-3.5 py-2.5 text-right">暂计利息</th>
                            <th className="px-3.5 py-2.5 text-right">暂计罚息</th>
                            <th className="px-3.5 py-2.5 text-right">暂计复利</th>
                            <th className="px-3.5 py-2.5">截息日期</th>
                            <th className="px-3.5 py-2.5 text-right">受理费 / 保全费</th>
                            <th className="px-3.5 py-2.5 text-center">靶向操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredClients.map((client) => {
                            const isSelected = selectedClientId === client.id;
                            return (
                              <tr
                                key={client.id}
                                onClick={() => handleSelectClient(client)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-950/60 text-white font-medium border-l-4 border-blue-500'
                                    : 'hover:bg-slate-900/70 text-slate-300'
                                }`}
                              >
                                <td className="px-3.5 py-2.5 text-center">
                                  {isSelected ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-sm shadow-blue-500/30">
                                      <UserCheck className="w-3 h-3" /> 清算中
                                    </span>
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-slate-700 inline-block"></span>
                                  )}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-slate-400">{client.id}</td>
                                <td className="px-3.5 py-2.5 font-mono text-xs text-blue-300 whitespace-nowrap">
                                  {client.caseNo || '-'}
                                </td>
                                <td className="px-3.5 py-2.5 font-bold text-white whitespace-nowrap">
                                  {client.defendant}
                                  {client.gender && <span className="ml-1 text-[11px] font-normal text-slate-400">({client.gender})</span>}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                                  {client.idCard || '-'}
                                </td>
                                <td className="px-3.5 py-2.5 text-slate-400 text-xs max-w-[150px] truncate" title={client.idAddress}>
                                  {client.idAddress || '-'}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                  ￥{formatMoney(client.principal)}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono text-slate-300 whitespace-nowrap">
                                  ￥{formatMoney(client.baseInterest)}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono text-amber-400 whitespace-nowrap">
                                  ￥{formatMoney(client.basePenalty)}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono text-purple-400 whitespace-nowrap">
                                  ￥{formatMoney(client.baseCompound)}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                                  {client.cutoffDate || '-'}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono text-xs text-slate-400 whitespace-nowrap">
                                  {client.litigationFee ? `￥${formatMoney(client.litigationFee)}` : '-'}{client.preservationFee ? ` / ￥${formatMoney(client.preservationFee)}` : ''}
                                </td>
                                <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectClient(client);
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                      isSelected
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                    }`}
                                  >
                                    {isSelected ? '✓ 正在清算' : '🎯 选定清算'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 银行贷款扣款明细与判决后还款冲减核算 */}
                {repayments.length > 0 && (
                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-emerald-400" />
                          <span>银行贷款扣款明细与判决后还款冲减核算</span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono">
                            共提取到 {repayments.length} 笔流水 · 选中 {repayments.filter(r => r.selected !== false).length} 笔参与算息
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>
                            参与冲减总还款：
                            <strong className="text-emerald-400 font-mono text-sm ml-1">
                              ￥{formatMoney(repayments.filter(r => r.selected !== false).reduce((s, r) => s + r.totalAmount, 0))}
                            </strong>
                          </span>
                          <span>
                            累计冲减本金：
                            <strong className="text-cyan-400 font-mono ml-1">
                              ￥{formatMoney(repayments.filter(r => r.selected !== false).reduce((s, r) => s + r.principal, 0))}
                            </strong>
                          </span>
                          <span>
                            累计冲减利息罚息：
                            <strong className="text-amber-400 font-mono ml-1">
                              ￥{formatMoney(repayments.filter(r => r.selected !== false).reduce((s, r) => s + r.interest + r.penalty + r.compound, 0))}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* 快捷操作按钮组 */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAfterBaseDate}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 transition"
                          title="自动选定在基准日之后发生的还款（基准日前还款通常已在起诉时冲减完毕）"
                        >
                          <Filter className="w-3 h-3" /> 仅选基准日后还款
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAllRepayments(true)}
                          className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                        >
                          全选
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAllRepayments(false)}
                          className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                        >
                          全不选
                        </button>
                        <button
                          type="button"
                          onClick={handleClearRepayments}
                          className="px-2 py-1 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 transition flex items-center gap-1"
                          title="移除扣款流水明细"
                        >
                          <Trash2 className="w-3 h-3" /> 清空流水
                        </button>
                      </div>
                    </div>

                    {/* 借据抬头摘要条（若有） */}
                    {receiptMeta && (
                      <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
                        {receiptMeta.borrowerName && <span>借款人：<strong className="text-slate-200">{receiptMeta.borrowerName}</strong></span>}
                        {receiptMeta.loanReceiptNo && <span>借据号：<span className="font-mono text-slate-200">{receiptMeta.loanReceiptNo}</span></span>}
                        {receiptMeta.loanAmount !== undefined && <span>借款金额：<span className="font-mono text-emerald-400">￥{formatMoney(receiptMeta.loanAmount)}</span></span>}
                        {receiptMeta.loanStartDate && <span>借款期限：<span className="font-mono text-slate-300">{receiptMeta.loanStartDate} 至 {receiptMeta.loanDueDate || '-'}</span></span>}
                        {receiptMeta.loanOrg && <span>经办机构：<span className="text-slate-300">{receiptMeta.loanOrg}</span></span>}
                      </div>
                    )}

                    {/* 还款明细表格 */}
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 max-h-72 overflow-y-auto shadow-inner">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-900/95 text-slate-400 border-b border-slate-800 text-[11px] sticky top-0 z-10 backdrop-blur-sm">
                          <tr>
                            <th className="px-3.5 py-2.5 text-center w-12">参与算息</th>
                            <th className="px-3.5 py-2.5">序号</th>
                            <th className="px-3.5 py-2.5">交易流水号</th>
                            <th className="px-3.5 py-2.5">扣款日期</th>
                            <th className="px-3.5 py-2.5 text-right text-emerald-400">归还本金 (元)</th>
                            <th className="px-3.5 py-2.5 text-right">归还利息 (元)</th>
                            <th className="px-3.5 py-2.5 text-right text-amber-400">归还罚息 (元)</th>
                            <th className="px-3.5 py-2.5 text-right text-purple-400">归还复利 (元)</th>
                            <th className="px-3.5 py-2.5 text-right font-bold text-white">还款总额 (元)</th>
                            <th className="px-3.5 py-2.5 text-center">状态说明 / 建议</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-sans">
                          {repayments.map((r, idx) => {
                            const isAfterBase = params?.baseDate ? dayjs(r.date).isAfter(dayjs(params.baseDate)) : true;
                            const isSelected = r.selected !== false;
                            return (
                              <tr
                                key={r.id || idx}
                                onClick={() => handleToggleRepayment(r.id)}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                                    : 'hover:bg-slate-900/60 opacity-60'
                                }`}
                              >
                                <td className="px-3.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleRepayment(r.id)}
                                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                                  />
                                </td>
                                <td className="px-3.5 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-3.5 py-2 font-mono font-medium text-slate-200">{r.serialNo}</td>
                                <td className="px-3.5 py-2 font-mono text-slate-300">{r.date}</td>
                                <td className="px-3.5 py-2 text-right font-mono font-semibold text-emerald-400">
                                  ￥{formatMoney(r.principal)}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono text-slate-300">
                                  ￥{formatMoney(r.interest)}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono text-amber-400">
                                  ￥{formatMoney(r.penalty)}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono text-purple-400">
                                  ￥{formatMoney(r.compound)}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono font-bold text-white">
                                  ￥{formatMoney(r.totalAmount)}
                                </td>
                                <td className="px-3.5 py-2 text-center">
                                  {isAfterBase ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                                      判决基准日后 · 冲减算息
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-900 border border-slate-800">
                                      基准日前 (已在判决本金中)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 人机协同微调表单 */}
                {params && (
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-blue-400" />
                        提取参数人机协同校验 (Human-in-the-Loop 实时联动重算)
                      </div>
                      <span className="text-[11px] text-slate-500">修改任意参数，清算底稿即刻自动刷新</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">债权基准日</label>
                        <input
                          type="date"
                          value={params.baseDate}
                          onChange={(e) => handleParamChange('baseDate', e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">尚欠本金余额 (元)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={params.principal}
                          onChange={(e) => handleParamChange('principal', parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">历史欠付利息 (元)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={params.baseInterest}
                          onChange={(e) => handleParamChange('baseInterest', parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">历史罚复利 (元)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={params.basePenalty}
                          onChange={(e) => handleParamChange('basePenalty', parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">利率定价模式</label>
                        <select
                          value={params.rateMode}
                          onChange={(e) => handleParamChange('rateMode', e.target.value as any)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                        >
                          <option value="LPR">LPR 浮动利率</option>
                          <option value="BENCHMARK">人民银行基准利率</option>
                          <option value="FIXED">固定年利率</option>
                        </select>
                      </div>

                      {params.rateMode === 'LPR' ? (
                        <>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-400">LPR 品种</label>
                            <select
                              value={params.lprTerm}
                              onChange={(e) => handleParamChange('lprTerm', e.target.value as any)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                            >
                              <option value="5Y">5年期以上</option>
                              <option value="1Y">1年期</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-400">加减基点 (BP)</label>
                            <input
                              type="number"
                              value={params.lprBp}
                              onChange={(e) => handleParamChange('lprBp', parseFloat(e.target.value) || 0)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold text-slate-400">固定年利率 (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={params.fixedRate || 0}
                            onChange={(e) => handleParamChange('fixedRate', parseFloat(e.target.value) || 0)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">罚息倍数 (如1.5倍)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={params.penaltyMultiple}
                          onChange={(e) => handleParamChange('penaltyMultiple', parseFloat(e.target.value) || 1.5)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">复利计息范围</label>
                        <select
                          value={params.compoundMode}
                          onChange={(e) => handleParamChange('compoundMode', e.target.value as any)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                        >
                          <option value="INT_AND_PENALTY">对利息与罚息均计收复利</option>
                          <option value="INT_ONLY">仅对正常利息计复利</option>
                          <option value="NONE">不计复利</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">加倍迟延履行利息</label>
                        <select
                          value={params.delayInterestEnabled ? 'YES' : 'NO'}
                          onChange={(e) => handleParamChange('delayInterestEnabled', e.target.value === 'YES')}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                        >
                          <option value="YES">计收 (日万分之1.75)</option>
                          <option value="NO">暂不计收</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 步骤 3：执行层（精确清算成果与法庭证据清单） */}
            {result && (
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-2xl backdrop-blur-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
                      3
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        司法级精确清算与法庭证据清单
                        <span className="text-xs font-normal text-slate-400">（已按人民银行与全国银行间调息日自动切割分段）</span>
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => exportToExcel(result, {
                      caseNo: analysisResult?.caseNo,
                      defendant: analysisResult?.defendant,
                      plaintiff: analysisResult?.plaintiff,
                      repayments: repayments.filter(r => r.selected !== false),
                    })}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" /> 导出“法院蓝”制式 Excel 证据清单
                  </button>
                </div>

                {/* 6 大核心清算汇总指标大屏 */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3">
                  <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
                      <span className="truncate">清算跨期天数</span>
                      <Calendar className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    </div>
                    <div className="text-base md:text-xl font-bold text-white">{result.totalDays} <span className="text-[11px] font-normal text-slate-400">天</span></div>
                    <div className="text-[10px] md:text-[11px] text-slate-500">实际天数 / 360</div>
                  </div>

                  <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[11px] font-medium">
                      <span className="truncate">最新计息本金余额</span>
                      <DollarSign className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    </div>
                    <div className="text-base md:text-xl font-bold text-slate-200 truncate">￥{formatMoney(result.principal)}</div>
                    <div className="text-[10px] md:text-[11px] text-slate-500">{result.totalRepaidPrincipal > 0 ? `已冲减本金 ￥${formatMoney(result.totalRepaidPrincipal)}` : '判决固定本金'}</div>
                  </div>

                  <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-amber-400/90 text-[11px] font-medium">
                      <span className="truncate">新发生利息/罚息</span>
                      <TrendingUp className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    </div>
                    <div className="text-base md:text-xl font-bold text-amber-400 truncate">￥{formatMoney(result.newPenalty)}</div>
                    <div className="text-[10px] md:text-[11px] text-slate-500">分段浮动累加</div>
                  </div>

                  <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-amber-400/90 text-[11px] font-medium">
                      <span className="truncate">新发生复利</span>
                      <TrendingUp className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    </div>
                    <div className="text-base md:text-xl font-bold text-amber-400 truncate">￥{formatMoney(result.newCompound)}</div>
                    <div className="text-[10px] md:text-[11px] text-slate-500">滚动欠息复利</div>
                  </div>

                  <div className="p-3 md:p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-indigo-400 text-[11px] font-medium">
                      <span className="truncate">迟延履行加倍金</span>
                      <Clock className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    </div>
                    <div className="text-base md:text-xl font-bold text-indigo-400 truncate">￥{formatMoney(result.delayInterest)}</div>
                    <div className="text-[10px] md:text-[11px] text-slate-500">日万分之 1.75</div>
                  </div>

                  <div className="p-3 md:p-4 rounded-xl bg-gradient-to-br from-red-950/60 to-red-900/40 border border-red-700/50 space-y-1">
                    <div className="flex items-center justify-between text-red-300 text-[11px] font-bold">
                      <span className="truncate">{result.totalRepaid > 0 ? '扣减还款后结欠净额' : '债权本息合计总额'}</span>
                      <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 text-red-400 flex-shrink-0" />
                    </div>
                    <div className="text-lg md:text-2xl font-black text-red-400 truncate">￥{formatMoney(result.netDebt !== undefined ? result.netDebt : result.totalDebt)}</div>
                    <div className="text-[10px] md:text-[11px] text-red-300/80 truncate">
                      {result.totalRepaid > 0 
                        ? `已冲减还款 -￥${formatMoney(result.totalRepaid)} (原总额￥${formatMoney(result.totalDebt)})`
                        : '包含基准日前未清款'}
                    </div>
                  </div>
                </div>

                {/* 分段利息测算明细表 */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                    <h3 className="text-sm font-bold text-slate-200">
                      分段计息测算流水明细清单（按中国人民银行调息日及还款节点自动切割）：
                    </h3>
                    <span className="text-xs text-slate-500">
                      已自动匹配对应历史周期报价与动态冲减本金
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="min-w-full divide-y divide-slate-800 text-xs text-left">
                      <thead className="bg-slate-950/80 text-slate-300 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="px-3.5 py-3 text-center w-12">序号</th>
                          <th className="px-3.5 py-3">分段区间</th>
                          <th className="px-3.5 py-3 text-right">实际天数</th>
                          <th className="px-3.5 py-3 text-right">对应基准/LPR</th>
                          <th className="px-3.5 py-3 text-right">执行罚息年利率</th>
                          <th className="px-3.5 py-3 text-right">计息本金基数</th>
                          <th className="px-3.5 py-3 text-right">本段利息/罚息</th>
                          <th className="px-3.5 py-3 text-right">本段复利</th>
                          <th className="px-3.5 py-3 text-right">迟延履行金</th>
                          <th className="px-3.5 py-3 text-center">事件说明 / 还款</th>
                          <th className="px-3.5 py-3 text-right font-bold text-white">区间小计(元)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        {result.intervals.map((row, idx) => (
                          <tr key={idx} className="hover:bg-blue-950/20 transition-colors">
                            <td className="px-3.5 py-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 font-medium text-slate-200">{row.start} 至 {row.end}</td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-slate-300">{row.days}</td>
                            <td className="px-3.5 py-2.5 text-right text-blue-400 font-mono font-medium">{row.baseRate.toFixed(2)}%</td>
                            <td className="px-3.5 py-2.5 text-right text-amber-400 font-mono font-bold">{row.penaltyRate.toFixed(4)}%</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-300 font-mono">￥{formatMoney(row.principal)}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-200 font-mono">￥{formatMoney(row.interest)}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-200 font-mono">￥{formatMoney(row.compound)}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-200 font-mono">￥{formatMoney(row.delay)}</td>
                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                              {row.repaidTotal ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 inline-flex items-center gap-1">
                                  <ArrowDownCircle className="w-3 h-3" />
                                  冲减还款 ￥{formatMoney(row.repaidTotal)}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  {row.eventDesc || '调息分段'}
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-emerald-400 font-mono">￥{formatMoney(row.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 视图 2：内置利率数据中心 ---------------- */}
        {activeTab === 'rates' && (
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">中国人民银行贷款基准利率及全国银行间 LPR 历史数据库</h2>
                <p className="text-xs text-slate-400 mt-1">
                  涵盖 2000 年至今历次存贷款基准利率调整及 2019 年 8 月以来的全部 LPR 报价，为确定性分段精算提供数据基座。
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-xs">
                <thead className="bg-slate-950 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left">生效/公布日期</th>
                    <th className="px-4 py-3 text-left">类型</th>
                    <th className="px-4 py-3 text-right">1年期 / 短期利率 (%)</th>
                    <th className="px-4 py-3 text-right">5年期以上 / 中长期利率 (%)</th>
                    <th className="px-4 py-3 text-left">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                  {RATE_HISTORY.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="px-4 py-2.5 font-mono text-slate-200">{item.date}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          item.type === 'LPR' ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50' : 'bg-purple-900/50 text-purple-300 border border-purple-700/50'
                        }`}>
                          {item.type === 'LPR' ? 'LPR报价' : '央行基准'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-blue-400 font-medium">{item.r1.toFixed(2)}%</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-400 font-medium">{item.r5.toFixed(2)}%</td>
                      <td className="px-4 py-2.5 text-slate-400">{item.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- 视图 3：司法裁判与算法规则说明 ---------------- */}
        {activeTab === 'guide' && (
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">金融借款司法清算核心计算逻辑与裁判依据</h2>
              <p className="text-xs text-slate-400 mt-1">符合《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》及金融借款司法解释标准。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-blue-400 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> 1. 浮动利率与分段切割原则
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  若合同约定或法院判决以 <strong>LPR / 央行基准利率</strong> 浮动计息，清算引擎会自动检索基准日至清偿日之间的全部调息节点。对每一个调息周期，严格执行“算头不算尾”法，以当期适用的基准利率加上/减去约定基点（BP）计算实际天数的利息。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> 2. 罚息与复利计付口径
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  逾期罚息通常按借款合同约定利率加收 30%~50%（即上浮 1.3~1.5 倍）。复利则分为“仅对欠付利息计复利”和“对欠付利息及罚息合并计收复利”。本引擎支持动态选择，且计复利利率按当期实际罚息利率执行。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-indigo-400 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> 3. 加倍迟延履行期间债务利息
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  依据《中华人民共和国民事诉讼法》第二百六十四条及最高法《关于执行程序中计算迟延履行期间的债务利息若干问题的解释》，加倍部分债务利息计付公式为：<strong>尚未清偿的生效法律文书确定的金钱债务 × 日万分之一点七五 × 迟延履行天数</strong>。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> 4. 证据链条交付与 Excel 质证底稿
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  导出的 Excel 文件遵循<strong>司法证据“法院蓝”制式标准</strong>，包含案卷基本信息、裁判主文摘要、6大汇总指标以及每一天的分段利息发生额与公式溯源，满足执行立案、庭审举证、破产债权申报的严格要求。
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 大模型配置弹窗 */}
      <LLMConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={llmConfig}
        onSave={(newCfg) => setLlmConfig(newCfg)}
      />
    </div>
  );
};
