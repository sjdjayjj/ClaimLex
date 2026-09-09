import React, { useState, useRef, useEffect } from 'react';
import { InterestCalculator } from '../core/calculator';
import { CalculationParams, CalculationResult } from '../core/types';
import { RATE_HISTORY } from '../core/rates';
import { extractTextFromPDF } from '../parser/pdfUtil';
import { cleanDocumentText } from '../parser/textCleaner';
import { exportToExcel } from '../core/exportUtil';
import { LLMConfigModal } from './LLMConfigModal';
import { LLMConfig, ParsedAnalysisResult } from '../services/llmTypes';
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
  Info
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

  // 计算引擎状态
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [params, setParams] = useState<CalculationParams | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setUploadedFileName('粤民终1268号民事判决书_样本.pdf');
    setInputText(SAMPLE_JUDGMENT);
    setScannedWarning(false);
    setErrorMessage(null);
    setExtractStats(null);
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
    const updated = { ...params, [field]: value };
    setParams(updated);
    try {
      const calculator = new InterestCalculator();
      const calcResult = calculator.calculate(updated);
      setResult(calcResult);
    } catch (err) {
      console.error(err);
    }
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

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={loadSample}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-700/50 hover:bg-blue-900/60 transition-all shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" /> 一键载入真实判决样例
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
                          value={params.principal}
                          onChange={(e) => handleParamChange('principal', parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">历史欠付利息 (元)</label>
                        <input
                          type="number"
                          value={params.baseInterest}
                          onChange={(e) => handleParamChange('baseInterest', parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-slate-400">历史罚复利 (元)</label>
                        <input
                          type="number"
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
                    onClick={() => exportToExcel(result)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" /> 导出“法院蓝”制式 Excel 证据清单
                  </button>
                </div>

                {/* 6 大核心清算汇总指标大屏 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                      <span>清算跨期天数</span>
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-xl font-bold text-white">{result.totalDays} <span className="text-xs font-normal text-slate-400">天</span></div>
                    <div className="text-[11px] text-slate-500">实际天数 / 360</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                      <span>基准日本金余额</span>
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-xl font-bold text-slate-200">￥{result.principal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-[11px] text-slate-500">判决固定本金</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-amber-400/90 text-xs font-medium">
                      <span>新发生利息/罚息</span>
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-amber-400">￥{result.newPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-[11px] text-slate-500">分段浮动累加</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-amber-400/90 text-xs font-medium">
                      <span>新发生复利</span>
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-amber-400">￥{result.newCompound.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-[11px] text-slate-500">滚动欠息复利</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-indigo-400 text-xs font-medium">
                      <span>迟延履行加倍金</span>
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="text-xl font-bold text-indigo-400">￥{result.delayInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-[11px] text-slate-500">日万分之 1.75</div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/60 to-red-900/40 border border-red-700/50 space-y-1">
                    <div className="flex items-center justify-between text-red-300 text-xs font-bold">
                      <span>债权本息合计总额</span>
                      <ShieldCheck className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="text-2xl font-black text-red-400">￥{result.totalDebt.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <div className="text-[11px] text-red-300/80">包含基准日前未清款</div>
                  </div>
                </div>

                {/* 分段利息测算明细表 */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                    <h3 className="text-sm font-bold text-slate-200">
                      分段计息测算流水明细清单（按中国人民银行及全国银行间利率调息日自动切割）：
                    </h3>
                    <span className="text-xs text-slate-500">
                      已自动匹配对应历史周期报价
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
                            <td className="px-3.5 py-2.5 text-right text-slate-300 font-mono">￥{row.principal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-200 font-mono">￥{row.interest.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-200 font-mono">￥{row.compound.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-3.5 py-2.5 text-right text-slate-200 font-mono">￥{row.delay.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-emerald-400 font-mono">￥{row.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
