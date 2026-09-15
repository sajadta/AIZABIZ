const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf-8');

// Add to props interface
code = code.replace(/dailyProfit: number;\n\}/, 'dailyProfit: number;\n  onOpenAlerts: () => void;\n}');

// Add to component destructuring
code = code.replace(/  dailyProfit,\n\}\) => \{/, '  dailyProfit,\n  onOpenAlerts\n}) => {');

// Add the Bell button right before Sound Toggle
const search = `{/* Sound Toggle */}`;
const replace = `{/* Alerts Toggle */}
          <button
            id="btn-alerts-toggle"
            onClick={onOpenAlerts}
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
            title={language === 'ml' ? 'അലർട്ടുകൾ' : 'Price Alerts'}
          >
            <BellRing className="w-4 h-4" />
          </button>
          
          {/* Sound Toggle */}`;
code = code.replace(search, replace);

fs.writeFileSync('src/components/Header.tsx', code);
