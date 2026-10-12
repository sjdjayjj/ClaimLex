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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl text-slate-100 flex flex-col">
        
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                大模型 (LLM) 接口与推理配置
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700/50">
                  司法文书专用
                </span>
              </h2>
              <p className="text-xs text-slate-400">配置您的大模型 API 地址、密钥及调用参数，用于解析裁判文书</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容主体 */}
        <div className="p-6 space-y-6 flex-1 text-sm">
          
          {/* 预设快捷选择 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
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
                    className={`p-2.5 rounded-xl text-left border transition relative overflow-hidden ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-200 shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-xs truncate">{preset.name}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{preset.model}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 核心必填参数 */}
          <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
            
            {/* API 地址 */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  API 调用完整地址 (Full Endpoint URL) <span className="text-red-400">*</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">需包含 /chat/completions</span>
              </label>
              <input
                type="text"
                value={config.apiUrl}
                onChange={e => setConfig({ ...config, apiUrl: e.target.value })}
                placeholder="https://api.deepseek.com/chat/completions"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />

              {/* 智能 URL 补全提示 */}
              {urlCheck.hasSuggestion && (
                <div className="mt-2 p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-center justify-between gap-2 text-xs text-amber-300">
                  <div className="flex items-center gap-1.5 truncate">
                    <Wand2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span className="truncate">建议补全路径：<span className="font-mono text-white">{urlCheck.fixedUrl}</span></span>
                  </div>
                  <button
                    type="button"
                    onClick={applyUrlFix}
                    className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[11px] transition shadow"
                  >
                    一键更正
                  </button>
                </div>
              )}
            </div>

            {/* 模型名称 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  模型名称标识 (Model Identifier) <span className="text-red-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400">支持直接输入任意自定义模型标识</span>
              </div>
              <input
                type="text"
                value={config.model}
                onChange={e => setConfig({ ...config, model: e.target.value })}
                placeholder="例如 deepseek-flash、qwen-plus、moonshot-v1-32k 等"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
              />
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500">常用/最新模型快速填充:</span>
                {[
                  'deepseek-flash',
                  'deepseek-reasoner',
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
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {mName}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  API 访问密钥 (API Key / Bearer Token) <span className="text-red-400">*</span>
                </span>
                <span className="text-[11px] text-emerald-400/80">仅保存在当前浏览器本地，不外泄</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={config.apiKey}
                  onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

          </div>

          {/* 高级 API 参数折叠栏 */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/50 transition"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                具体 API 接口参数设置 (请求方法、版本、自定义 Headers、超时)
              </span>
              <span className="text-[11px] text-slate-400">
                {showAdvanced ? '收起 ▲' : '展开自定义设置 ▼'}
              </span>
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-4 border-t border-slate-800 bg-slate-950/30 text-xs">
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 请求方法 */}
                  <div>
                    <label className="block text-slate-400 mb-1">HTTP 请求方法</label>
                    <select
                      value={config.method}
                      onChange={e => setConfig({ ...config, method: e.target.value as 'POST' | 'PUT' })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="POST">POST (默认)</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>

                  {/* 接口版本 */}
                  <div>
                    <label className="block text-slate-400 mb-1">接口版本 (API Version)</label>
                    <input
                      type="text"
                      value={config.apiVersion}
                      onChange={e => setConfig({ ...config, apiVersion: e.target.value })}
                      placeholder="v1"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* 数据流空闲超时 */}
                  <div>
                    <label className="block text-slate-400 mb-1">数据流空闲超时 (秒)</label>
                    <input
                      type="number"
                      min={10}
                      max={600}
                      value={Math.round((config.timeoutMs || 90000) / 1000)}
                      onChange={e => setConfig({ ...config, timeoutMs: Math.max(10, Number(e.target.value)) * 1000 })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      仅在连续 N 秒未收到任何模型数据时才中断；每收到一次数据自动续期。长文书推理可保持 90 秒默认值。
                    </p>
                  </div>
                </div>

                {/* 本地代理转发开关 */}
                <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/40 flex items-center justify-between">
                  <div>
                    <div className="text-slate-200 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      本地开发服务器代理转发 (消除浏览器跨域 CORS 拦截)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      推荐开启。由本地 Node.js 开发服务代发请求，解决部分官方接口在前端浏览器中的 CORS 跨域拦截与网络握手问题。
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                    <input
                      type="checkbox"
                      checked={config.useLocalProxy !== false}
                      onChange={e => setConfig({ ...config, useLocalProxy: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* 采样温度 */}
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>推理温度 (Temperature)</span>
                    <span className="font-mono text-blue-400">{config.temperature} (法务提取建议 0.0 - 0.2)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={config.temperature}
                    onChange={e => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* 自定义 Headers 列表 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-slate-300 font-medium">自定义 Request Headers</label>
                    <button
                      type="button"
                      onClick={handleAddHeader}
                      className="text-[11px] flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加 Header
                    </button>
                  </div>

                  {(!config.customHeaders || config.customHeaders.length === 0) ? (
                    <div className="text-[11px] text-slate-500 italic py-2">
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
                            className="rounded border-slate-700 bg-slate-900 text-blue-600"
                          />
                          <input
                            type="text"
                            placeholder="Header Name (例如 X-Custom-Auth)"
                            value={item.key}
                            onChange={e => handleUpdateHeader(idx, 'key', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                          />
                          <input
                            type="text"
                            placeholder="Header Value"
                            value={item.value}
                            onChange={e => handleUpdateHeader(idx, 'value', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveHeader(idx)}
                            className="text-red-400 hover:text-red-300 p-1"
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
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                  : 'bg-red-950/40 border-red-800/60 text-red-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 whitespace-pre-wrap font-mono text-[11px]">
                {testResult.message}
              </div>
            </div>
          )}

        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90 sticky bottom-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !config.apiUrl.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-medium transition border border-slate-700"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                正在连通测试...
              </>
            ) : (
              <>
                <Server className="w-3.5 h-3.5 text-blue-400" />
                测试 API 连通性
              </>
            )}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white text-xs transition"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/30 transition"
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
