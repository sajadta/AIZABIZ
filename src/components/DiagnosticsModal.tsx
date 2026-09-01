import React, { useState, useEffect } from 'react';
import { ShieldAlert, Activity, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Language } from '../types';

export const DiagnosticsModal = ({ onClose, language }: { onClose: () => void, language: Language }) => {
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/bot/diagnostics');
            const data = await res.json();
            setHealth(data);
        } catch(e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 3000);
        return () => clearInterval(interval);
    }, []);

    const renderStatus = (condition: boolean, goodText: string, badText: string) => {
        if (condition) {
            return <div className="flex items-center gap-1.5 text-emerald-400 font-bold"><CheckCircle2 className="w-4 h-4"/> {goodText}</div>;
        }
        return <div className="flex items-center gap-1.5 text-rose-400 font-bold"><AlertTriangle className="w-4 h-4"/> {badText}</div>;
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        {language === 'ml' ? 'ആൽഗോ സിസ്റ്റം ഡയഗ്നോസ്റ്റിക്സ്' : 'Algo System Diagnostics'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-5 space-y-4">
                    {loading && !health ? (
                         <div className="flex items-center justify-center py-8 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
                    ) : health ? (
                         <div className="space-y-4 text-sm">
                             <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                                 <span className="text-slate-400">Upstox API Token</span>
                                 {renderStatus(health.hasUpstoxToken, 'Connected', 'Missing Token')}
                             </div>
                             <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                                 <span className="text-slate-400">Upstox WebSocket (Live Data)</span>
                                 {renderStatus(health.upstoxWsConnected, 'Active', 'Disconnected')}
                             </div>
                             <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
                                 <span className="text-slate-400">Bot Engine Status</span>
                                 {renderStatus(health.botEnabled, 'Running', 'Paused')}
                             </div>
                             
                             <div className="grid grid-cols-2 gap-3 mt-4">
                                 <div className="bg-indigo-950/20 p-3 rounded-lg border border-indigo-900/30 text-center">
                                     <div className="text-xs text-slate-500 mb-1">Live Quotes Tracked</div>
                                     <div className="text-xl font-black text-indigo-300">{health.liveQuotesTracked}</div>
                                 </div>
                                 <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-900/30 text-center">
                                     <div className="text-xs text-slate-500 mb-1">Active Subscriptions</div>
                                     <div className="text-xl font-black text-amber-300">{health.subscribedKeysCount}</div>
                                 </div>
                             </div>

                             <div className="text-xs text-slate-500 text-center mt-2 flex flex-col gap-1">
                                 <span>Last Quote Received: {health.lastQuoteTime ? new Date(health.lastQuoteTime).toLocaleTimeString() : 'Never'}</span>
                                 <span>Server Time: {new Date(health.systemTime).toLocaleTimeString()}</span>
                                 {health.lastWsError && <span className="text-rose-400 mt-2">WS Error: {health.lastWsError}</span>}
                             </div>

                             {!health.upstoxWsConnected && (
                                 <div className="mt-4 p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg text-xs text-rose-300">
                                     <strong>Warning:</strong> Live websocket is disconnected. Options prices won't update, and PNL might be stuck at 0. Please verify your Upstox API token is valid and hasn't expired.
                                 </div>
                             )}
                         </div>
                    ) : (
                         <div className="text-center text-rose-400">Failed to load diagnostics.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
