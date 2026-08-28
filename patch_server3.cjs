const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `    // Fetch live quotes to update PNL
    const token = upstoxConfig.accessToken;
    const instruments = (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50';
    if (token)  {`;

const replaceStr = `    // Fetch live quotes to update PNL
    const token = upstoxConfig.accessToken;
    if (!token) {
        botSignals.length = 0; // Clear any existing fake signals
        return; // DO NOT USE DUMMY DATA.
    }
    const instruments = (botConfig as any).selectedInstrumentKey || 'NSE_INDEX|Nifty 50';
    if (token)  {`;

code = code.replace(targetStr, replaceStr);

// Also remove the "APK" button from the Header.
const headerTarget = `          {/* Android App / APK button */}
          <button
            onClick={() => setIsAndroidModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/50 transition whitespace-nowrap"
          >
            <Smartphone className="w-4 h-4" />
            <span>{language === 'ml' ? 'ആപ്പ് / APK' : 'Android App'}</span>
          </button>`;
let headerCode = fs.readFileSync('src/components/Header.tsx', 'utf8');
headerCode = headerCode.replace(headerTarget, '');
fs.writeFileSync('src/components/Header.tsx', headerCode);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts 3 and Header.tsx");
