const fs = require('fs');
let code = fs.readFileSync('src/components/AlgoBotPanel.tsx', 'utf8');

const target1 = `{signals.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-spin" />
                <p className="text-xs font-semibold">
                  {language === 'ml' ? scanMessagesMl[scanMessageIndex] : scanMessagesEn[scanMessageIndex]}
                </p>
              </div>
            ) : (
              signals.map((sig) => (`;

const replace1 = `{botConfig.enabled && (
               <div className="p-4 mb-4 text-center text-slate-300 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center gap-3">
                 <Activity className="w-5 h-5 text-emerald-500 animate-pulse" />
                 <p className="text-xs font-semibold animate-pulse">
                   {language === 'ml' ? scanMessagesMl[scanMessageIndex] : scanMessagesEn[scanMessageIndex]}
                 </p>
               </div>
            )}
            
            {signals.length === 0 && !botConfig.enabled ? (
              <div className="p-8 text-center text-slate-500">
                <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-semibold">
                  {language === 'ml' ? 'ബോട്ട് ഓഫാണ്' : 'Bot is offline'}
                </p>
              </div>
            ) : (
              signals.map((sig) => (`;

code = code.replace(target1, replace1);
fs.writeFileSync('src/components/AlgoBotPanel.tsx', code);
console.log('Patched AlgoBotPanel');
