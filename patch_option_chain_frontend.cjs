const fs = require('fs');
let code = fs.readFileSync('src/components/OptionChainView.tsx', 'utf8');

const target = `  if (!data) {
    return (
      <div className="bg-[#0b0f19] rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
        <p className="text-xs font-semibold">{language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ വിവരങ്ങൾ ലോഡ് ചെയ്യുന്നു...' : 'Loading real-time Option Chain data...'}</p>
      </div>
    );
  }`;

const replacement = `  if (!data || (data as any).error) {
    return (
      <div className="bg-[#0b0f19] rounded-2xl border border-slate-800 p-8 text-center flex flex-col items-center justify-center h-full">
        <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
        <p className="text-sm font-semibold text-rose-400 mb-2">{(data as any)?.error || (language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ ലഭ്യമായില്ല' : 'Option Chain Unavailable')}</p>
        <p className="text-xs text-slate-500 max-w-xs">{language === 'ml' ? 'Upstox API യുമായി കണക്ട് ചെയ്യുക.' : 'Please connect your Upstox API to view live option chain.'}</p>
        <button onClick={onRefresh} className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors">
           <RefreshCw size={14} /> {language === 'ml' ? 'വീണ്ടും ശ്രമിക്കുക' : 'Retry'}
        </button>
      </div>
    );
  }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/components/OptionChainView.tsx', code);
    console.log('Option Chain View Patched');
} else {
    console.log('Target not found in OptionChainView');
}
