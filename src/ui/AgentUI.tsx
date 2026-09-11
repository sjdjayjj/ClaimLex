import React, { useState, useRef, useEffect } from 'react';
import { InterestCalculator, roundToFen } from '../core/calculator';
import { CalculationParams, CalculationResult } from '../core/types';
import { RATE_HISTORY } from '../core/rates';
import { extractTextFromPDF } from '../parser/pdfUtil';
import { cleanDocumentText } from '../parser/textCleaner';
import { exportToExcel } from '../core/exportUtil';
import { LLMConfigModal } from './LLMConfigModal';
import { LLMConfig, ParsedAnalysisResult, BatchCaseClient } from '../services/llmTypes';
import { loadLLMConfig, analyzeJudgmentWithLLM } from '../services/llmService';
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
  Menu,
  X,
  Zap,
  UploadCloud,
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

  // 计算引擎状态
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [params, setParams] = useState<CalculationParams | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smartisan 交互：移动端导航抽屉 + 控制台平滑滚动锚点
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // 平滑滚动到指定区块
  const scrollToSection = (id: 'console' | 'settings' | 'capabilities') => {
    setMobileMenuOpen(false);
    const map = { console: consoleRef, settings: settingsRef } as const;
    if (id === 'capabilities') {
      document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    map[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Hero“启动解析”：滚动到控制台并聚焦文本输入
  const handleStartParse = () => {
    scrollToSection('console');
    setTimeout(() => {
      const ta = document.getElementById('case-text') as HTMLTextAreaElement | null;
      ta?.focus();
    }, 350);
  };

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
    setParams(updated);
    try {
      const calculator = new InterestCalculator();
      const calcResult = calculator.calculate(updated);
      setResult(calcResult);
    } catch (err) {
      console.error(err);
    }
  };

  // 能力卡片配置（对应 3 个 Tab 视图）
  const capabilityCards = [
    { id: 'agent' as const, icon: Bot, title: 'AI Agent 智能解纷主控台', desc: '调度要素提取、利息清算与证据生成，按司法逻辑链自动执行。', active: activeTab === 'agent' },
    { id: 'rates' as const, icon: Database, title: '利率数据中心', desc: '覆盖 2000-2026 贷款基准利率与 LPR 浮动利率，支持跨期自动匹配。', active: activeTab === 'rates' },
    { id: 'guide' as const, icon: Scale, title: '司法裁判规则说明', desc: '内置利息起止、清偿抵充、诉讼时效等校验规则，输出可复核依据。', active: activeTab === 'guide' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <main>
        {/* ============ 顶部 Header（吸顶 + 细线） ============ */}
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md hairline-bottom no-print">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <Scale className="w-5 h-5 text-primary" />
              <span className="text-base sm:text-lg font-semibold tracking-tight text-foreground">ClaimLex</span>
            </div>

            {/* 桌面端导航 */}
            <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
              <button onClick={() => scrollToSection('capabilities')} className="hover:text-foreground transition-colors">产品能力</button>
              <button onClick={() => scrollToSection('console')} className="hover:text-foreground transition-colors">解析控制台</button>
              <button onClick={() => scrollToSection('settings')} className="hover:text-foreground transition-colors">设置</button>
            </nav>

            <div className="flex items-center gap-2">
              {/* 模型配置入口 */}
              <button
                onClick={() => setIsConfigOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  !llmConfig.apiKey
                    ? 'border-state-warning/40 bg-state-warning/10 text-state-warning'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
                title="配置大模型 API 地址、密钥及参数"
              >
                <Settings2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline truncate max-w-[8rem]">{llmConfig.model || '未设置'}</span>
                {!llmConfig.apiKey ? (
                  <span className="sm:hidden px-1.5 py-0.5 rounded text-[10px] bg-state-warning text-white font-bold">需配置</span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-state-success" />
                )}
              </button>

              {/* 打印底稿 */}
              <button
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-muted transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> 打印底稿
              </button>

              {/* 移动端菜单切换 */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-border bg-card text-foreground hover:bg-muted transition-colors"
                aria-label="菜单"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 移动端抽屉导航 */}
          {mobileMenuOpen && (
            <nav className="md:hidden border-t border-border bg-card animate-slide-down">
              <div className="max-w-5xl mx-auto px-4 py-2 flex flex-col">
                <button onClick={() => scrollToSection('capabilities')} className="text-left py-2.5 text-sm text-muted-foreground hover:text-foreground border-b border-border/60">产品能力</button>
                <button onClick={() => scrollToSection('console')} className="text-left py-2.5 text-sm text-muted-foreground hover:text-foreground border-b border-border/60">解析控制台</button>
                <button onClick={() => scrollToSection('settings')} className="text-left py-2.5 text-sm text-muted-foreground hover:text-foreground border-b border-border/60">解析设置</button>
                <button onClick={() => { setMobileMenuOpen(false); window.print(); }} className="text-left py-2.5 text-sm text-muted-foreground hover:text-foreground">打印底稿</button>
              </div>
            </nav>
          )}
        </header>

        {/* ============ Hero 区 ============ */}
        <section className="pt-12 sm:pt-20 pb-12 sm:pb-16 no-print">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground mb-5 sm:mb-6">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                真实 LLM 语义要素提取
              </span>
              <span className="hidden sm:inline-block w-px h-3 bg-border" />
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                司法级 0 误差清算中枢
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-balance keep-all mb-4 sm:mb-5" style={{ lineHeight: 1.2 }}>
              金融司法裁判智能解纷系统
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mb-5 sm:mb-6 text-balance">
              基于大模型 Agent 的金融借贷纠纷智能裁判与债权清算助理
            </p>
            <p className="max-w-3xl mx-auto text-sm sm:text-base text-ink-2 leading-relaxed mb-7 sm:mb-8">
              直击特资清收与法务诉讼重灾痛点：通过大模型深度理解非结构化文书要素，结合司法级利息算法执行 2000 至今基准/LPR 浮动利率跨期清算，一键生成法庭质证标准的制式证据底稿。
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mb-8 sm:mb-10">
              模型: <span className="font-mono">{llmConfig.model || 'deepseek-chat'}</span>
              <span className="mx-1.5 text-border">|</span>
              {llmConfig.apiKey ? <span className="text-state-success">已配置 Key</span> : '需配置 Key'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md border border-border bg-card text-foreground hover:bg-muted transition-colors"
              >
                <Printer className="w-4 h-4" /> 打印底稿
              </button>
              <button
                onClick={handleStartParse}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-smartisan-1"
              >
                <Zap className="w-4 h-4" /> 启动解析
              </button>
            </div>
          </div>
        </section>

        {/* ============ 核心能力（3 卡片，对应 3 个 Tab） ============ */}
        <section id="capabilities" className="hairline-top no-print">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 text-balance keep-all">核心能力</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-8 sm:mb-10">由 Agent 主控、利率库支撑、规则库校验的三层解纷链路</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-lg overflow-hidden border border-border bg-card shadow-smartisan-1">
              {capabilityCards.map((cap, idx) => {
                const Icon = cap.icon;
                return (
                  <button
                    key={cap.id}
                    onClick={() => setActiveTab(cap.id)}
                    className={`text-left p-5 sm:p-6 transition-colors hover:bg-muted/60 ${
                      idx < 2 ? 'md:hairline-right' : ''
                    } ${idx > 0 ? 'hairline-top md:hairline-none' : ''} ${
                      cap.active ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Icon className={`w-5 h-5 ${cap.active ? 'text-primary' : 'text-ink-2'}`} />
                      </div>
                      <h3 className="text-sm sm:text-base font-medium keep-all">{cap.title}</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{cap.desc}</p>
                    {cap.active && (
                      <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary font-medium">
                        当前视图 <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============ 异常错误提示 ============ */}
        {errorMessage && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-md p-4 bg-state-error/10 border border-state-error/30 text-state-error text-xs flex items-start gap-3 shadow-smartisan-1 animate-fade-in no-print">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-bold text-sm">执行或配置提示</div>
                <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{errorMessage}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="px-3 py-1.5 rounded-md bg-state-error/90 hover:opacity-90 text-white font-medium transition text-xs"
                >
                  配置大模型
                </button>
                <button onClick={() => setErrorMessage(null)} className="text-state-error hover:opacity-70 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================= 视图 1：Agent 主控台 ============================= */}
        {activeTab === 'agent' && (
          <div className="space-y-10 sm:space-y-16 pt-10 sm:pt-16">
            {/* ---------- 文书输入控制台 ---------- */}
            <section id="console" ref={consoleRef} className="scroll-mt-20">
              <div className="max-w-5xl mx-auto px-4 sm:px-6">
                <div className="bg-card rounded-lg p-5 sm:p-6 md:p-8 shadow-smartisan-2 border border-border">
                  <div className="mb-5 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 text-balance keep-all">文书输入</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">裁判文书/借款合同感知层（支持上传 PDF 自动清洗或直接输入正文）</p>
                  </div>

                  {/* 样例快捷按钮 */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 sm:mb-6">
                    <button
                      onClick={loadSample}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-muted transition-colors"
                      title="载入普通单一案件判决书示例"
                    >
                      <FileText className="w-3.5 h-3.5" /> 单一案件样例
                    </button>
                    <button
                      onClick={loadBatchSample}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card text-foreground hover:bg-muted transition-colors"
                      title="载入包含《原告诉讼请求附表》的批量案件裁判文书示例（含多位借款人）"
                    >
                      <Layers className="w-3.5 h-3.5" /> 载入批量案件附表样例（消金系列案）
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                      {isUploading ? '正在解析 PDF...' : '上传裁判文书 (PDF)'}
                    </button>
                  </div>

                  {/* 扫描件预警 */}
                  {scannedWarning && (
                    <div className="mb-5 sm:mb-6 p-3 bg-state-warning/10 border border-state-warning/30 rounded-md text-xs text-ink flex items-start gap-2 animate-fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-state-warning mt-0.5" />
                      <span>
                        提示：该 PDF 提取到的文本量极少，可能为<strong>纯图片扫描件</strong>。若解析不全，建议使用已 OCR 的文档或直接粘贴文书正文。
                      </span>
                    </div>
                  )}

                  {/* 拖拽上传区 */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="border border-dashed border-border rounded-md p-6 sm:p-8 text-center mb-5 sm:mb-6 bg-background hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mx-auto mb-3">
                      <UploadCloud className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">点击或拖拽上传 PDF</p>
                    <p className="text-xs text-muted-foreground">支持 .pdf，最大 20 MB</p>
                  </div>

                  {/* 正文输入 */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">正文输入</label>
                    <textarea
                      id="case-text"
                      rows={10}
                      placeholder="可将判决书 PDF 文件直接拖拽到此处，或粘贴借款合同文本、民事起诉状、判决主文..."
                      className="w-full px-3 sm:px-4 py-3 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                        {uploadedFileName ? (
                          <span className="text-state-success flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 已加载：{uploadedFileName}
                          </span>
                        ) : (
                          <span id="char-count">字符数：{inputText.length} / 10000</span>
                        )}
                        {extractStats && (
                          <span className="text-ink-3 text-[11px]">
                            (共 {extractStats.pages} 页，过滤杂质噪音 {extractStats.filtered} 行)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>模型：<span className="font-mono text-primary">{llmConfig.model || '未设置'}</span></span>
                        <span className="text-border">|</span>
                        <span>计息标准：实际天数 ÷ 360</span>
                      </div>
                    </div>
                  </div>

                  {/* 启动 Agent 执行 */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-5 sm:mt-6 pt-4 border-t border-border">
                    <div className="text-xs text-muted-foreground min-h-[1.25rem]">
                      {isParsing && (
                        <div className="flex items-center gap-2 text-primary font-mono animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{parseProgressText || '正在调度大模型与司法解析引擎...'}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleExecuteAgent}
                      disabled={isParsing || !inputText.trim()}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-medium text-sm transition-all ${
                        isParsing || !inputText.trim()
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:opacity-90 shadow-smartisan-1 active:scale-[0.98]'
                      }`}
                    >
                      {isParsing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          正在进行真实 LLM 推理与清算...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          启动真实大模型智能解析与债权清算
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ---------- 解析设置（参数人机协同微调） ---------- */}
            {params && (
              <section id="settings" ref={settingsRef} className="scroll-mt-20 no-print">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-5 sm:mb-6 text-balance keep-all">解析设置</h2>
                  <div className="bg-card rounded-lg p-5 sm:p-6 shadow-smartisan-1 border border-border space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">提取参数人机协同校验（Human-in-the-Loop 实时联动重算）</span>
                      </div>
                      <span className="hidden sm:inline text-[11px] text-muted-foreground">修改任意参数，清算底稿即刻自动刷新</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      {/* 当前调用模型 */}
                      <button
                        onClick={() => setIsConfigOpen(true)}
                        className="text-left p-4 rounded-md border border-border bg-background hover:bg-muted transition-colors"
                      >
                        <label className="block text-xs font-medium text-ink-2 mb-1.5">当前调用模型</label>
                        <div className="flex items-center justify-between text-sm text-foreground">
                          <span className="font-mono truncate">{llmConfig.model || '未设置'}</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">{llmConfig.apiKey ? 'API Key 已配置' : '需配置 API Key 后方可调用'}</p>
                      </button>

                      {/* 计息标准 */}
                      <div className="p-4 rounded-md border border-border bg-background">
                        <label className="block text-xs font-medium text-ink-2 mb-1.5">计息标准</label>
                        <div className="flex items-center justify-between text-sm text-foreground">
                          <span>实际天数 ÷ 360</span>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">按实际占用天数计息，年度基数 360 天</p>
                      </div>

                      {/* 债权基准日 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">债权基准日</label>
                        <input
                          type="date"
                          value={params.baseDate}
                          onChange={(e) => handleParamChange('baseDate', e.target.value)}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* 尚欠本金余额 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">尚欠本金余额 (元)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={params.principal}
                          onChange={(e) => handleParamChange('principal', parseFloat(e.target.value) || 0)}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* 历史欠付利息 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">历史欠付利息 (元)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={params.baseInterest}
                          onChange={(e) => handleParamChange('baseInterest', parseFloat(e.target.value) || 0)}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* 历史罚复利 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">历史罚复利 (元)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={params.basePenalty}
                          onChange={(e) => handleParamChange('basePenalty', parseFloat(e.target.value) || 0)}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      {/* 利率定价模式 */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">利率定价模式</label>
                        <select
                          value={params.rateMode}
                          onChange={(e) => handleParamChange('rateMode', e.target.value as any)}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="LPR">LPR 浮动利率</option>
                          <option value="BENCHMARK">人民银行基准利率</option>
                          <option value="FIXED">固定年利率</option>
                        </select>
                      </div>

                      {params.rateMode === 'LPR' ? (
                        <>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-ink-2">LPR 品种</label>
                            <select
                              value={params.lprTerm}
                              onChange={(e) => handleParamChange('lprTerm', e.target.value as any)}
                              className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="5Y">5年期以上</option>
                              <option value="1Y">1年期</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-ink-2">加减基点 (BP)</label>
                            <input
                              type="number"
                              value={params.lprBp}
                              onChange={(e) => handleParamChange('lprBp', parseFloat(e.target.value) || 0)}
                              className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="block text-xs font-medium text-ink-2">固定年利率 (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={params.fixedRate || 0}
                            onChange={(e) => handleParamChange('fixedRate', parseFloat(e.target.value) || 0)}
                            className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">罚息倍数 (如1.5倍)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={params.penaltyMultiple}
                          onChange={(e) => handleParamChange('penaltyMultiple', parseFloat(e.target.value) || 1.5)}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">复利计息范围</label>
                        <select
                          value={params.compoundMode}
                          onChange={(e) => handleParamChange('compoundMode', e.target.value as any)}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="INT_AND_PENALTY">对利息与罚息均计收复利</option>
                          <option value="INT_ONLY">仅对正常利息计复利</option>
                          <option value="NONE">不计复利</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-ink-2">加倍迟延履行利息</label>
                        <select
                          value={params.delayInterestEnabled ? 'YES' : 'NO'}
                          onChange={(e) => handleParamChange('delayInterestEnabled', e.target.value === 'YES')}
                          className="w-full text-sm px-2.5 py-2 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="YES">计收 (日万分之1.75)</option>
                          <option value="NO">暂不计收</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ---------- 大模型司法分析报告 ---------- */}
            {analysisResult && (
              <section className="print-block">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                  <div className="bg-card rounded-lg p-5 sm:p-6 md:p-8 shadow-smartisan-2 border border-border space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0">2</div>
                        <div>
                          <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                            大模型司法文书结构化研判报告
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{llmConfig.model} 提取与论证</span>
                          </h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {analysisResult.rawOutput && (
                          <button
                            onClick={() => setShowRawOutput(!showRawOutput)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-card hover:bg-muted text-foreground border border-border transition no-print"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                            {showRawOutput ? '收起模型原文' : '查看模型原始响应'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 核心文书元信息 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 sm:p-4 bg-muted/50 rounded-md border border-border">
                        <div className="text-[11px] text-muted-foreground">判决案号</div>
                        <div className="text-sm font-semibold text-foreground font-mono mt-0.5 break-all">{analysisResult.caseNo || '未识别案号 / 非涉诉文书'}</div>
                      </div>
                      <div className="p-3 sm:p-4 bg-muted/50 rounded-md border border-border">
                        <div className="text-[11px] text-muted-foreground">原告 / 债权人</div>
                        <div className="text-sm font-medium text-foreground mt-0.5 truncate">{analysisResult.plaintiff || '文书未明确'}</div>
                      </div>
                      <div className="p-3 sm:p-4 bg-muted/50 rounded-md border border-border">
                        <div className="text-[11px] text-muted-foreground">被告 / 债务人</div>
                        <div className="text-sm font-medium text-foreground mt-0.5 truncate">{analysisResult.defendant || '文书未明确'}</div>
                      </div>
                    </div>

                    {/* 司法论证结论 */}
                    <div className="p-4 bg-primary/5 rounded-md border border-primary/20 space-y-2">
                      <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        【大模型裁判事实与法律逻辑审查结论】：
                      </div>
                      <p className="text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-wrap">{analysisResult.reasoning}</p>

                      {analysisResult.keyPoints && analysisResult.keyPoints.length > 0 && (
                        <div className="pt-2 border-t border-primary/20 space-y-1">
                          <div className="text-[11px] text-primary font-medium">提取要点提炼：</div>
                          <ul className="list-disc list-inside text-xs text-ink-2 space-y-0.5">
                            {analysisResult.keyPoints.map((pt, idx) => (
                              <li key={idx}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* 大模型原始 JSON 折叠 */}
                    {showRawOutput && analysisResult.rawOutput && (
                      <div className="p-3 rounded-md bg-muted/40 border border-border space-y-1.5 no-print animate-fade-in">
                        <div className="text-[11px] text-muted-foreground flex justify-between items-center">
                          <span>大模型完整响应文本 (Raw Output):</span>
                          <span className="text-[10px] text-ink-3">用于法务核验审计</span>
                        </div>
                        <pre className="p-3 bg-card rounded-md text-ink text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap smartisan-scroll border border-border">
                          {analysisResult.rawOutput}
                        </pre>
                      </div>
                    )}

                    {/* 批量案件客户附表选择器 */}
                    {analysisResult.batchClients && analysisResult.batchClients.length > 0 && (
                      <div className="pt-4 border-t border-border space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                              <Users className="w-4 h-4 text-primary" />
                              <span>批量案件借款人客户附表明细与靶向选择器</span>
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 font-mono">
                                共识别到 {analysisResult.batchClients.length} 位客户
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              系统当前正在清算客户：
                              <span className="text-primary font-semibold ml-1 bg-primary/10 px-2 py-0.5 rounded border border-primary/30">
                                {analysisResult.batchClients.find(c => c.id === selectedClientId)?.defendant || analysisResult.defendant}
                              </span>
                              <span className="text-muted-foreground ml-2 font-mono">
                                (案号: {analysisResult.batchClients.find(c => c.id === selectedClientId)?.caseNo || analysisResult.caseNo})
                              </span>
                              <span className="text-ink-3 ml-2 text-[11px]">点击任一客户即可一键切换精准清算与生成质证清单</span>
                            </div>
                          </div>

                          <div className="relative w-full sm:w-64">
                            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={clientSearchKeyword}
                              onChange={(e) => setClientSearchKeyword(e.target.value)}
                              placeholder="搜索姓名、身份证、案号..."
                              className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>

                        {/* 客户列表表格 */}
                        <div className="overflow-x-auto rounded-md border border-border bg-card max-h-80 overflow-y-auto smartisan-scroll no-print">
                          <table className="w-full text-left text-xs text-ink">
                            <thead className="bg-muted text-muted-foreground border-b border-border text-[11px] sticky top-0 z-10">
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
                            <tbody className="divide-y divide-border">
                              {filteredClients.map((client) => {
                                const isSelected = selectedClientId === client.id;
                                return (
                                  <tr
                                    key={client.id}
                                    onClick={() => handleSelectClient(client)}
                                    className={`cursor-pointer transition-colors ${
                                      isSelected ? 'bg-primary/5 text-foreground font-medium border-l-4 border-primary' : 'hover:bg-muted/60 text-ink'
                                    }`}
                                  >
                                    <td className="px-3.5 py-2.5 text-center">
                                      {isSelected ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                                          <UserCheck className="w-3 h-3" /> 清算中
                                        </span>
                                      ) : (
                                        <span className="w-2 h-2 rounded-full bg-line-strong inline-block"></span>
                                      )}
                                    </td>
                                    <td className="px-3.5 py-2.5 font-mono text-muted-foreground">{client.id}</td>
                                    <td className="px-3.5 py-2.5 font-mono text-xs text-primary whitespace-nowrap">{client.caseNo || '-'}</td>
                                    <td className="px-3.5 py-2.5 font-semibold text-foreground whitespace-nowrap">
                                      {client.defendant}
                                      {client.gender && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({client.gender})</span>}
                                    </td>
                                    <td className="px-3.5 py-2.5 font-mono text-xs text-ink whitespace-nowrap">{client.idCard || '-'}</td>
                                    <td className="px-3.5 py-2.5 text-muted-foreground text-xs max-w-[150px] truncate" title={client.idAddress}>{client.idAddress || '-'}</td>
                                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground whitespace-nowrap">￥{formatMoney(client.principal)}</td>
                                    <td className="px-3.5 py-2.5 text-right font-mono text-ink whitespace-nowrap">￥{formatMoney(client.baseInterest)}</td>
                                    <td className="px-3.5 py-2.5 text-right font-mono text-state-warning whitespace-nowrap">￥{formatMoney(client.basePenalty)}</td>
                                    <td className="px-3.5 py-2.5 text-right font-mono text-state-info whitespace-nowrap">￥{formatMoney(client.baseCompound)}</td>
                                    <td className="px-3.5 py-2.5 font-mono text-xs text-ink whitespace-nowrap">{client.cutoffDate || '-'}</td>
                                    <td className="px-3.5 py-2.5 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                                      {client.litigationFee ? `￥${formatMoney(client.litigationFee)}` : '-'}{client.preservationFee ? ` / ￥${formatMoney(client.preservationFee)}` : ''}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleSelectClient(client); }}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-line text-foreground border border-border'
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
                  </div>
                </div>
              </section>
            )}

            {/* ---------- 司法级精确清算与法庭证据清单 ---------- */}
            {result && (
              <section className="print-block">
                <div className="max-w-5xl mx-auto px-4 sm:px-6">
                  <div className="bg-card rounded-lg p-5 sm:p-6 md:p-8 shadow-smartisan-2 border border-border space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-state-success/10 text-state-success flex items-center justify-center font-bold text-sm border border-state-success/30 shrink-0">3</div>
                        <div>
                          <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                            司法级精确清算与法庭证据清单
                            <span className="text-xs font-normal text-muted-foreground">（已按人民银行与全国银行间调息日自动切割分段）</span>
                          </h2>
                        </div>
                      </div>
                      <button
                        onClick={() => exportToExcel(result, {
                          caseNo: analysisResult?.caseNo,
                          defendant: analysisResult?.defendant,
                          plaintiff: analysisResult?.plaintiff,
                        })}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold bg-primary hover:opacity-90 text-primary-foreground transition-opacity no-print"
                      >
                        <Download className="w-4 h-4" /> 导出“法院蓝”制式 Excel 证据清单
                      </button>
                    </div>

                    {/* 6 大核心清算汇总指标 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 md:gap-3">
                      <div className="p-3 md:p-4 rounded-md bg-muted/40 border border-border space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
                          <span className="truncate">清算跨期天数</span>
                          <Calendar className="w-3 h-3 text-primary shrink-0" />
                        </div>
                        <div className="text-base md:text-xl font-bold text-foreground">{result.totalDays} <span className="text-[11px] font-normal text-muted-foreground">天</span></div>
                        <div className="text-[10px] md:text-[11px] text-ink-3">实际天数 / 360</div>
                      </div>
                      <div className="p-3 md:p-4 rounded-md bg-muted/40 border border-border space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
                          <span className="truncate">基准日本金余额</span>
                          <DollarSign className="w-3 h-3 text-ink-3 shrink-0" />
                        </div>
                        <div className="text-base md:text-xl font-bold text-ink truncate">￥{formatMoney(result.principal)}</div>
                        <div className="text-[10px] md:text-[11px] text-ink-3">判决固定本金</div>
                      </div>
                      <div className="p-3 md:p-4 rounded-md bg-state-warning/5 border border-state-warning/20 space-y-1">
                        <div className="flex items-center justify-between text-state-warning text-[11px] font-medium">
                          <span className="truncate">新发生利息/罚息</span>
                          <TrendingUp className="w-3 h-3 text-state-warning shrink-0" />
                        </div>
                        <div className="text-base md:text-xl font-bold text-state-warning truncate">￥{formatMoney(result.newPenalty)}</div>
                        <div className="text-[10px] md:text-[11px] text-ink-3">分段浮动累加</div>
                      </div>
                      <div className="p-3 md:p-4 rounded-md bg-state-warning/5 border border-state-warning/20 space-y-1">
                        <div className="flex items-center justify-between text-state-warning text-[11px] font-medium">
                          <span className="truncate">新发生复利</span>
                          <TrendingUp className="w-3 h-3 text-state-warning shrink-0" />
                        </div>
                        <div className="text-base md:text-xl font-bold text-state-warning truncate">￥{formatMoney(result.newCompound)}</div>
                        <div className="text-[10px] md:text-[11px] text-ink-3">滚动欠息复利</div>
                      </div>
                      <div className="p-3 md:p-4 rounded-md bg-state-info/5 border border-state-info/20 space-y-1">
                        <div className="flex items-center justify-between text-state-info text-[11px] font-medium">
                          <span className="truncate">迟延履行加倍金</span>
                          <Clock className="w-3 h-3 text-state-info shrink-0" />
                        </div>
                        <div className="text-base md:text-xl font-bold text-state-info truncate">￥{formatMoney(result.delayInterest)}</div>
                        <div className="text-[10px] md:text-[11px] text-ink-3">日万分之 1.75</div>
                      </div>
                      <div className="p-3 md:p-4 rounded-md bg-primary/10 border border-primary/30 space-y-1">
                        <div className="flex items-center justify-between text-primary text-[11px] font-bold">
                          <span className="truncate">债权本息合计总额</span>
                          <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 text-primary shrink-0" />
                        </div>
                        <div className="text-lg md:text-2xl font-bold text-primary truncate">￥{formatMoney(result.totalDebt)}</div>
                        <div className="text-[10px] md:text-[11px] text-primary/70">包含基准日前未清款</div>
                      </div>
                    </div>

                    {/* 分段利息测算明细表 */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                        <h3 className="text-sm font-semibold text-ink">分段计息测算流水明细清单（按中国人民银行及全国银行间利率调息日自动切割）：</h3>
                        <span className="text-xs text-muted-foreground">已自动匹配对应历史周期报价</span>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="min-w-full divide-y divide-border text-xs text-left">
                          <thead className="bg-muted/60 text-muted-foreground font-semibold tracking-wider">
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
                              <th className="px-3.5 py-3 text-right font-bold text-foreground">区间小计(元)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-card">
                            {result.intervals.map((row, idx) => (
                              <tr key={idx} className="hover:bg-muted/40 transition-colors">
                                <td className="px-3.5 py-2.5 text-center text-ink-3 font-mono">{idx + 1}</td>
                                <td className="px-3.5 py-2.5 font-medium text-ink whitespace-nowrap">{row.start} 至 {row.end}</td>
                                <td className="px-3.5 py-2.5 text-right font-bold text-ink">{row.days}</td>
                                <td className="px-3.5 py-2.5 text-right text-primary font-mono font-medium">{row.baseRate.toFixed(2)}%</td>
                                <td className="px-3.5 py-2.5 text-right text-state-warning font-mono font-bold">{row.penaltyRate.toFixed(4)}%</td>
                                <td className="px-3.5 py-2.5 text-right text-ink font-mono">￥{formatMoney(row.principal)}</td>
                                <td className="px-3.5 py-2.5 text-right text-ink font-mono">￥{formatMoney(row.interest)}</td>
                                <td className="px-3.5 py-2.5 text-right text-ink font-mono">￥{formatMoney(row.compound)}</td>
                                <td className="px-3.5 py-2.5 text-right text-ink font-mono">￥{formatMoney(row.delay)}</td>
                                <td className="px-3.5 py-2.5 text-right font-bold text-primary font-mono">￥{formatMoney(row.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ============================= 视图 2：利率数据中心 ============================= */}
        {activeTab === 'rates' && (
          <section className="pt-12 sm:pt-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="bg-card rounded-lg p-5 sm:p-6 md:p-8 shadow-smartisan-2 border border-border space-y-4">
                <div className="pb-3 border-b border-border">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">中国人民银行贷款基准利率及全国银行间 LPR 历史数据库</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    涵盖 2000 年至今历次存贷款基准利率调整及 2019 年 8 月以来的全部 LPR 报价，为确定性分段精算提供数据基座。
                  </p>
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="min-w-full divide-y divide-border text-xs">
                    <thead className="bg-muted/60 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">生效/公布日期</th>
                        <th className="px-4 py-3 text-left">类型</th>
                        <th className="px-4 py-3 text-right">1年期 / 短期利率 (%)</th>
                        <th className="px-4 py-3 text-right">5年期以上 / 中长期利率 (%)</th>
                        <th className="px-4 py-3 text-left">说明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {RATE_HISTORY.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-ink">{item.date}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              item.type === 'LPR' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-state-info/10 text-state-info border-state-info/30'
                            }`}>
                              {item.type === 'LPR' ? 'LPR报价' : '央行基准'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-primary font-medium">{item.r1.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-right font-mono text-state-success font-medium">{item.r5.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{item.remark}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============================= 视图 3：司法裁判规则说明 ============================= */}
        {activeTab === 'guide' && (
          <section className="pt-12 sm:pt-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="bg-card rounded-lg p-5 sm:p-6 md:p-8 shadow-smartisan-2 border border-border space-y-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground">金融借款司法清算核心计算逻辑与裁判依据</h2>
                  <p className="text-xs text-muted-foreground mt-1">符合《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》及金融借款司法解释标准。</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-md bg-muted/30 border border-border space-y-2">
                    <h3 className="font-semibold text-primary text-sm flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> 1. 浮动利率与分段切割原则
                    </h3>
                    <p className="text-ink leading-relaxed">
                      若合同约定或法院判决以 <strong>LPR / 央行基准利率</strong> 浮动计息，清算引擎会自动检索基准日至清偿日之间的全部调息节点。对每一个调息周期，严格执行“算头不算尾”法，以当期适用的基准利率加上/减去约定基点（BP）计算实际天数的利息。
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/30 border border-border space-y-2">
                    <h3 className="font-semibold text-state-warning text-sm flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" /> 2. 罚息与复利计付口径
                    </h3>
                    <p className="text-ink leading-relaxed">
                      逾期罚息通常按借款合同约定利率加收 30%~50%（即上浮 1.3~1.5 倍）。复利则分为“仅对欠付利息计复利”和“对欠付利息及罚息合并计收复利”。本引擎支持动态选择，且计复利利率按当期实际罚息利率执行。
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/30 border border-border space-y-2">
                    <h3 className="font-semibold text-state-info text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> 3. 加倍迟延履行期间债务利息
                    </h3>
                    <p className="text-ink leading-relaxed">
                      依据《中华人民共和国民事诉讼法》第二百六十四条及最高法《关于执行程序中计算迟延履行期间的债务利息若干问题的解释》，加倍部分债务利息计付公式为：<strong>尚未清偿的生效法律文书确定的金钱债务 × 日万分之一点七五 × 迟延履行天数</strong>。
                    </p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/30 border border-border space-y-2">
                    <h3 className="font-semibold text-state-success text-sm flex items-center gap-1.5">
                      <Download className="w-4 h-4" /> 4. 证据链条交付与 Excel 质证底稿
                    </h3>
                    <p className="text-ink leading-relaxed">
                      导出的 Excel 文件遵循<strong>司法证据“法院蓝”制式标准</strong>，包含案卷基本信息、裁判主文摘要、6大汇总指标以及每一天的分段利息发生额与公式溯源，满足执行立案、庭审举证、破产债权申报的严格要求。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ============ Footer ============ */}
        <footer className="hairline-top mt-16 sm:mt-20 no-print">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>&copy; 2026 ClaimLex. 金融司法裁判智能解纷系统. 保留所有权利.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foreground transition-colors">隐私协议</a>
              <a href="#" className="hover:text-foreground transition-colors">服务条款</a>
              <a href="#" className="hover:text-foreground transition-colors">联系我们</a>
            </div>
          </div>
        </footer>
      </main>

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
