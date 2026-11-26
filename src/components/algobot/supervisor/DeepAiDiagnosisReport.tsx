import React from 'react';
import { Brain } from 'lucide-react';
import type { Language } from '../../../types';

interface DeepAiDiagnosisReportProps {
  report: any;
  language: Language;
}

export const DeepAiDiagnosisReport: React.FC<DeepAiDiagnosisReportProps> = ({
  report,
  language,
}) => (
  <>
    {/* Deep AI Diagnosis Report (if generated) */}
    {report && (
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/40 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-fuchsia-400" />
            <span>
              {language === 'ml'
                ? 'AI സൂപ്പർവൈസർ ഡീപ്പ് ഡയഗ്നോസിസ് റിപ്പോർട്ട്'
                : 'AI Supervisor Deep Diagnosis Report'}
            </span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">{report.timestamp}</span>
        </div>
        <p className="text-slate-100 leading-relaxed font-semibold">
          {language === 'ml' ? report.summaryMl : report.summaryEn}
        </p>
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/30 text-[11px] text-amber-200">
          <strong className="text-amber-400 block mb-0.5">
            {language === 'ml' ? '🔍 പ്രധാന കണ്ടെത്തലും കാരണവും:' : '🔍 Root-Cause Analysis:'}
          </strong>
          {report.rootCauseMl}
        </div>
        {Array.isArray(report.actionableUpgradesMl) && (
          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-black uppercase text-emerald-400 block">
              {language === 'ml'
                ? '✅ സീറോ-ലോസ് & 100% മാക്സിമം പ്രോഫിറ്റ് പരിഹാരങ്ങൾ:'
                : '✅ Zero-Loss & 100% Peak Profit Solutions:'}
            </span>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-200">
              {report.actionableUpgradesMl.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}
  </>
);
