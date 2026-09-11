import React, { useState } from 'react';
import { LLMConfig, HeaderItem } from '../services/llmTypes';
import { LLM_PRESETS, testLLMConnection, saveLLMConfig, fixIncompleteApiUrl } from '../services/llmService';
import {
  X,
  Key,
  Globe,
  Cpu,
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Sparkles,
  Eye,
  EyeOff,
  HelpCircle,
  Server,
  Wand2
} from 'lucide-react';

interface LLMConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LLMConfig;
  onSave: (newConfig: LLMConfig) => void;
}

export const LLMConfigModal: React.FC<LLMConfigModalProps> = ({
  isOpen,
  onClose,
  config: initialConfig,
  onSave,
}) => {
  const [config, setConfig] = useState<LLMConfig>({ ...initialConfig });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  if (!isOpen) return null;

  // 快捷应用厂商预设
  const handleSelectPreset = (presetId: string) => {
    const preset = LLM_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setConfig(prev => ({
      ...prev,
      providerName: preset.name,
      apiUrl: preset.apiUrl,
      apiVersion: preset.apiVersion,
      model: preset.model,
    }));
    setTestResult(null);
  };

  // 检查 URL 建议
  const urlCheck = fixIncompleteApiUrl(config.apiUrl);

  const applyUrlFix = () => {
    if (urlCheck.hasSuggestion && urlCheck.fixedUrl) {
      setConfig(prev => ({ ...prev, apiUrl: urlCheck.fixedUrl }));
      setTestResult(null);
    }
  };

  // 添加自定义 Header
  const handleAddHeader = () => {
    const newHeader: HeaderItem = { key: '', value: '', enabled: true };
    setConfig(prev => ({
      ...prev,
      customHeaders: [...(prev.customHeaders || []), newHeader],
    }));
  };

  // 更新 Header
  const handleUpdateHeader = (index: number, field: keyof HeaderItem, val: any) => {
    setConfig(prev => {
      const updated = [...(prev.customHeaders || [])];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, customHeaders: updated };
    });
  };

  // 删除 Header
  const handleRemoveHeader = (index: number) => {
    setConfig(prev => ({
      ...prev,
      customHeaders: (prev.customHeaders || []).filter((_, i) => i !== index),
    }));
  };

  // 连通性测试
  const handleTestConnection = async () => {
    // 若存在 URL 自动修复，先自动应用
    let currentConfig = { ...config };
    if (urlCheck.hasSuggestion && urlCheck.fixedUrl) {
      currentConfig.apiUrl = urlCheck.fixedUrl;
      setConfig(currentConfig);
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testLLMConnection(currentConfig);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || '连接测试异常',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSave = () => {
    if (!config.apiUrl.trim()) {
      alert('请输入完整的 API 调用地址');
      return;
    }
    if (!config.model.trim()) {
      alert('请输入模型名称');
      return;
    }

    let saveTarget = { ...config };
    if (urlCheck.hasSuggestion && urlCheck.fixedUrl) {
      saveTarget.apiUrl = urlCheck.fixedUrl;
    }

    saveLLMConfig(saveTarget);
    onSave(saveTarget);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto smartisan-scroll bg-popover border border-border rounded-lg shadow-smartisan-3 text-popover-foreground flex flex-col">

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 border border-primary/20 text-primary">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
                大模型 (LLM) 接口与推理配置
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">司法文书专用</span>
              </h2>
              <p className="text-xs text-muted-foreground">配置您的大模型 API 地址、密钥及调用参数，用于解析裁判文书</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容主体 */}
        <div className="p-5 sm:p-6 space-y-6 flex-1 text-sm">

          {/* 预设快捷选择 */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              快捷选择官方/主流模型预设模板
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LLM_PRESETS.map(preset => {
                const isSelected = config.apiUrl === preset.apiUrl && config.model === preset.model;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-2.5 rounded-md text-left border transition relative overflow-hidden ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background border-border hover:border-line-strong text-foreground'
                    }`}
                  >
                    <div className="font-medium text-xs truncate">{preset.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">{preset.model}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 核心必填参数 */}
          <div className="space-y-4 bg-muted/30 p-4 rounded-md border border-border">

            {/* API 地址 */}
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-ink-2 mb-1">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  API 调用完整地址 (Full Endpoint URL) <span className="text-state-error">*</span>
                </span>
                <span className="text-[11px] text-muted-foreground font-normal">需包含 /chat/completions</span>
              </label>
              <input
                type="text"
                value={config.apiUrl}
                onChange={e => setConfig({ ...config, apiUrl: e.target.value })}
                placeholder="https://api.deepseek.com/chat/completions"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {/* 智能 URL 补全提示 */}
              {urlCheck.hasSuggestion && (
                <div className="mt-2 p-2.5 bg-state-warning/10 border border-state-warning/30 rounded-md flex items-center justify-between gap-2 text-xs text-state-warning">
                  <div className="flex items-center gap-1.5 truncate">
                    <Wand2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">建议补全路径：<span className="font-mono text-foreground">{urlCheck.fixedUrl}</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={applyUrlFix}
                    className="shrink-0 px-2.5 py-1 bg-primary hover:opacity-90 text-primary-foreground font-medium rounded text-[11px] transition"
                  >
                    一键更正
                  </button>
                </div>
              )}
            </div>

            {/* 模型名称 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
                  <Cpu className="w-3.5 h-3.5 text-state-info" />
                  模型名称标识 (Model Identifier) <span className="text-state-error">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground">支持直接输入任意自定义模型标识</span>
              </div>
              <input
                type="text"
                value={config.model}
                onChange={e => setConfig({ ...config, model: e.target.value })}
                placeholder="例如 gemini-3.8-flash, deepseek-chat, gpt-4o 等"
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-muted-foreground">常用/最新模型快速填充:</span>
                {[
                  'gemini-3.8-flash',
                  'deepseek-chat',
                  'gpt-4o',
                  'qwen-plus',
                  'qwen-max',
                  'moonshot-v1-32k'
                ].map((mName) => (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => setConfig({ ...config, model: mName })}
                    className={`px-2 py-0.5 rounded font-mono border transition ${
                      config.model === mName
                        ? 'bg-primary/10 border-primary text-primary font-medium'
                        : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {mName}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="flex items-center justify-between text-xs font-medium text-ink-2 mb-1">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-state-success" />
                  API 访问密钥 (API Key / Bearer Token) <span className="text-state-error">*</span>
                </span>
                <span className="text-[11px] text-state-success/80">仅保存在当前浏览器本地，不外泄</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full pl-3 pr-10 py-2 bg-background border border-input rounded-md text-foreground font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

          </div>

          {/* 高级 API 参数折叠栏 */}
          <div className="border border-border rounded-md overflow-hidden bg-card">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-ink-2 hover:bg-muted/50 transition"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-state-info" />
                具体 API 接口参数设置 (请求方法、版本、自定义 Headers、超时)
              </span>
              <span className="text-[11px] text-muted-foreground">
                {showAdvanced ? '收起 ▲' : '展开自定义设置 ▼'}
              </span>
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 border-t border-border bg-muted/20 text-xs">

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 请求方法 */}
                  <div>
                    <label className="block text-muted-foreground mb-1">HTTP 请求方法</label>
                    <select
                      value={config.method}
                      onChange={e => setConfig({ ...config, method: e.target.value as 'POST' | 'PUT' })}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="POST">POST (默认)</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>

                  {/* 接口版本 */}
                  <div>
                    <label className="block text-muted-foreground mb-1">接口版本 (API Version)</label>
                    <input
                      type="text"
                      value={config.apiVersion}
                      onChange={e => setConfig({ ...config, apiVersion: e.target.value })}
                      placeholder="v1"
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* 请求超时时间 */}
                  <div>
                    <label className="block text-muted-foreground mb-1">请求超时 (秒)</label>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={Math.round((config.timeoutMs || 90000) / 1000)}
                      onChange={e => setConfig({ ...config, timeoutMs: Math.max(10, Number(e.target.value)) * 1000 })}
                      className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* 本地代理转发开关 */}
                <div className="p-3 rounded-md bg-state-info/5 border border-state-info/20 flex items-center justify-between">
                  <div>
                    <div className="text-foreground font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-state-success"></span>
                      本地开发服务器代理转发 (消除浏览器跨域 CORS 拦截)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      推荐开启。由本地 Node.js 开发服务代发请求，解决 Google Gemini、OpenAI 等官方接口在前端浏览器中的 CORS 跨域拦截与网络握手问题。
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                    <input
                      type="checkbox"
                      checked={config.useLocalProxy !== false}
                      onChange={e => setConfig({ ...config, useLocalProxy: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-line-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* 采样温度 */}
                <div>
                  <div className="flex justify-between text-muted-foreground mb-1">
                    <span>推理温度 (Temperature)</span>
                    <span className="font-mono text-primary">{config.temperature} (法务提取建议 0.0 - 0.2)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature}
                    onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-line rounded-md appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* 自定义 Headers 列表 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-ink-2 font-medium">自定义 Request Headers</label>
                    <button
                      type="button"
                      onClick={handleAddHeader}
                      className="text-[11px] flex items-center gap-1 text-primary hover:opacity-80"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加 Header
                    </button>
                  </div>

                  {(!config.customHeaders || config.customHeaders.length === 0) ? (
                    <div className="text-[11px] text-muted-foreground italic py-2">
                      暂无自定义 Header（默认已自动携带 Content-Type 与 Authorization）
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {config.customHeaders.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={e => handleUpdateHeader(idx, 'enabled', e.target.checked)}
                            className="rounded border-border bg-background text-primary"
                          />
                          <input
                            type="text"
                            placeholder="Header Name (例如 X-Custom-Auth)"
                            value={item.key}
                            onChange={e => handleUpdateHeader(idx, 'key', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <input
                            type="text"
                            placeholder="Header Value"
                            value={item.value}
                            onChange={e => handleUpdateHeader(idx, 'value', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-background border border-input rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveHeader(idx)}
                            className="text-state-error hover:opacity-70 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* 连通性测试结果面板 */}
          {testResult && (
            <div
              className={`p-3.5 rounded-md border flex items-start gap-3 text-xs leading-relaxed ${
                testResult.success
                  ? 'bg-state-success/10 border-state-success/30 text-state-success'
                  : 'bg-state-error/10 border-state-error/30 text-state-error'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px]">
                {testResult.message}
              </div>
            </div>
          )}

        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-border bg-card sticky bottom-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !config.apiUrl.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-background hover:bg-muted disabled:opacity-50 text-foreground rounded-md text-xs font-medium transition border border-border"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                正在连通测试...
              </>
            ) : (
              <>
                <Server className="w-3.5 h-3.5 text-primary" />
                测试 API 连通性
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-xs transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-md text-xs font-medium transition"
            >
              <Save className="w-3.5 h-3.5" />
              保存并生效
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
