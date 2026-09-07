const fs = require('fs');
let code = fs.readFileSync('src/components/AlgoBotPanel.tsx', 'utf-8');

const newUI = `
            {/* Advanced Institutional Settings */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                 <Cpu size={16} className="text-indigo-400" /> 
                 Institutional AI Risk Management
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <label className="flex items-center justify-between text-xs text-slate-300">
                    <div>
                       <span className="block font-bold">Auto Kill-Switch</span>
                       <span className="text-[9px] text-slate-500">Stop trading if max loss reached</span>
                    </div>
                    <input type="checkbox" checked={botConfig.autoKillSwitch || false} onChange={e => onUpdateBotConfig({autoKillSwitch: e.target.checked})} className="toggle toggle-sm toggle-error" />
                 </label>
                 
                 <label className="flex items-center justify-between text-xs text-slate-300">
                    <div>
                       <span className="block font-bold">Market Regime Filter</span>
                       <span className="text-[9px] text-slate-500">Avoid sideways/choppy markets</span>
                    </div>
                    <input type="checkbox" checked={botConfig.marketRegimeFilter || false} onChange={e => onUpdateBotConfig({marketRegimeFilter: e.target.checked})} className="toggle toggle-sm toggle-info" />
                 </label>

                 <label className="flex items-center justify-between text-xs text-slate-300">
                    <div>
                       <span className="block font-bold">Dynamic Position Sizing</span>
                       <span className="text-[9px] text-slate-500">Auto scale qty based on AI confidence</span>
                    </div>
                    <input type="checkbox" checked={botConfig.dynamicPositionSizing || false} onChange={e => onUpdateBotConfig({dynamicPositionSizing: e.target.checked})} className="toggle toggle-sm toggle-success" />
                 </label>

                 <label className="flex items-center justify-between text-xs text-slate-300">
                    <div>
                       <span className="block font-bold">News & Sentiment Filter</span>
                       <span className="text-[9px] text-slate-500">Pause during high-impact news</span>
                    </div>
                    <input type="checkbox" checked={botConfig.newsSentimentFilter || false} onChange={e => onUpdateBotConfig({newsSentimentFilter: e.target.checked})} className="toggle toggle-sm toggle-warning" />
                 </label>
                 
                 <label className="flex items-center justify-between text-xs text-slate-300">
                    <div>
                       <span className="block font-bold">IV Crush Protection</span>
                       <span className="text-[9px] text-slate-500">Avoid buying when IV is dropping</span>
                    </div>
                    <input type="checkbox" checked={botConfig.ivCrushProtection || false} onChange={e => onUpdateBotConfig({ivCrushProtection: e.target.checked})} className="toggle toggle-sm toggle-secondary" />
                 </label>
              </div>
            </div>
`;

code = code.replace(
  /\{\/\* Daily Loss Lock \*\/\}/,
  newUI + '\n            {/* Daily Loss Lock */}'
);

if (!code.includes('import {') || !code.includes('Cpu')) {
   code = code.replace(/import {([^}]+)} from 'lucide-react';/, "import { $1, Cpu } from 'lucide-react';");
}

fs.writeFileSync('src/components/AlgoBotPanel.tsx', code);
console.log("Patched AlgoBotPanel.tsx");
