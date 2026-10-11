import React, { useState } from 'react';
import { AgentUI } from './ui/AgentUI';
import { LoginGate } from './ui/LoginGate';
import { getSession, logout, ClaimlexSession } from './services/authService';

export default function App() {
  const [session, setSession] = useState<ClaimlexSession | null>(() => getSession());

  // 未登录：仅渲染登录门，不加载任何业务内容
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <LoginGate onLogin={setSession} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AgentUI
        sessionUsername={session.username}
        onLogout={() => {
          logout();
          setSession(null);
        }}
      />
    </div>
  );
}
