import React from 'react';
import type { BotLog, Language } from '../../types';
interface LogsTabProps {
  language: Language;
  botLogs: BotLog[];
}
export const LogsTab: React.FC<LogsTabProps> = ({ language, botLogs }) => (
  <>
    <div className="bg-[#070a12] p-3 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1.5 max-h-[350px] overflow-y-auto">
      {botLogs.length === 0 ? (
        <p className="text-slate-500">No logs yet. Logs will stream here once bot is active.</p>
      ) : (
        botLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-2">
            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
            <span
              className={`font-bold shrink-0 ${
                log.type === 'SIGNAL'
                  ? 'text-cyan-400'
                  : log.type === 'EXECUTION' || log.type === 'TRADE'
                    ? 'text-blue-400'
                    : log.type === 'SL_TRIGGER' || log.type === 'ERROR'
                      ? 'text-rose-400'
                      : log.type === 'TP_TRIGGER' || log.type === 'SUCCESS'
                        ? 'text-emerald-400 font-bold'
                        : 'text-slate-400'
              }`}
            >
              [{log.type}]
            </span>
            <span className="text-slate-200">
              {language === 'ml' && log.messageMalayalam ? log.messageMalayalam : log.message}
            </span>
          </div>
        ))
      )}
    </div>
  </>
);
