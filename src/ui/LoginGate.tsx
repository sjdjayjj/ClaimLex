import React, { useState } from 'react';
import { Lock, Loader2, AlertCircle, Scale, ShieldCheck } from 'lucide-react';
import { login, ClaimlexSession } from '../services/authService';

interface LoginGateProps {
  onLogin: (session: ClaimlexSession) => void;
}

/**
 * 站点访问登录门：未登录时不渲染任何业务内容
 */
export const LoginGate: React.FC<LoginGateProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await login(username, password);
      onLogin(session);
    } catch (err: any) {
      setError(err.message || '登录失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* 背景光斑 */}
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
            <Scale className="w-9 h-9 text-blue-400" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            金融借贷纠纷智能裁判与债权清算助理
          </h1>
          <p className="mt-2 text-sm text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            涉案文书涉密，请先完成身份验证
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-700/70 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5 text-slate-100"
        >
          <div>
            <label htmlFor="login-username" className="block text-xs font-medium text-slate-300 mb-1.5">
              用户名
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-medium text-slate-300 mb-1.5">
              密码
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在验证身份...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                登录系统
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            本系统仅供授权人员使用，所有上传文书仅用于债权清算测算
          </p>
        </form>
      </div>
    </div>
  );
};
