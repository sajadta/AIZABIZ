import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, AlertCircle, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { UpstoxApiConfig } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
}

interface Props {
  apiConfig: UpstoxApiConfig;
  quotesCount: number;
}

export const LiveAiSupport: React.FC<Props> = ({ apiConfig, quotesCount }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'ഹലോ! ഞാൻ ഈ ആപ്പിന്റെ AI അസിസ്റ്റൻ്റ് ആണ്. ആപ്പ് ഉപയോഗിക്കുന്നതിൽ എന്തെങ്കിലും സംശയങ്ങളോ എററുകളോ ഉണ്ടെങ്കിൽ എന്നോട് ചോദിക്കാവുന്നതാണ്. തകരാറുകൾ പരിശോധിക്കാൻ താഴെയുള്ള "Run Diagnostics" ക്ലിക്ക് ചെയ്യുക.',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          systemStatus: {
            apiConnected: apiConfig.isConnected,
            apiTokenExists: !!apiConfig.accessToken,
            liveQuotesReceiving: quotesCount > 0,
            networkOnline: navigator.onLine,
            timestamp: new Date().toISOString()
          }
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.text }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Error connecting to AI Server. Please try again later.' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Network Error.' }]);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = () => {
    let diagMsg = '🔍 **System Diagnostics Report:**\n\n';
    
    if (navigator.onLine) {
      diagMsg += '✅ Network is Online.\n';
    } else {
      diagMsg += '❌ Network is Offline! Check your internet.\n';
    }

    if (apiConfig.isConnected) {
      diagMsg += '✅ Upstox API Connected.\n';
    } else {
      diagMsg += '❌ Upstox API Disconnected! Go to Settings (Key icon) and enter today\\'s Access Token.\n';
    }

    if (quotesCount > 0) {
      diagMsg += '✅ Live Market Data (Quotes) is streaming correctly.\n';
    } else {
      diagMsg += '⚠️ Live Market Data not receiving. (If market is closed, this is normal. Otherwise check token).\n';
    }

    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: diagMsg }]);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0e17] rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-200">AI Help & Diagnostics</h3>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
            </p>
          </div>
        </div>
        <button
          onClick={runDiagnostics}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded-lg transition"
        >
          <Zap className="w-3.5 h-3.5" />
          Run Diagnostics
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
              msg.sender === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-sm' 
                : msg.sender === 'system'
                ? 'bg-slate-800 border border-slate-700 text-slate-300 rounded-bl-sm font-mono whitespace-pre-wrap'
                : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-sm'
            }`}>
              {msg.sender === 'ai' && <Bot className="w-3.5 h-3.5 mb-1.5 text-indigo-400" />}
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-sm p-3">
              <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-slate-900/80 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your issue here..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
