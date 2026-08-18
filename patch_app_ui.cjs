const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add Support Component Import
if (!code.includes('LiveAiSupport')) {
  code = code.replace(
    "import { OrderModal } from './components/OrderModal';",
    "import { OrderModal } from './components/OrderModal';\nimport { LiveAiSupport } from './components/LiveAiSupport';"
  );
}

// 2. Add 'SUPPORT' to appTab type
code = code.replace(
  "const [appTab, setAppTab] = useState<'MARKETS' | 'BOT' | 'OPTIONS' | 'PORTFOLIO' | 'AI'>('MARKETS');",
  "const [appTab, setAppTab] = useState<'MARKETS' | 'BOT' | 'OPTIONS' | 'PORTFOLIO' | 'SUPPORT'>('MARKETS');"
);

// 3. Render Support tab content
const supportView = `
        {appTab === 'SUPPORT' && (
          <div className="h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <LiveAiSupport apiConfig={apiConfig} quotesCount={quotes.length} />
          </div>
        )}
`;

code = code.replace(
  "{appTab === 'AI' && (",
  supportView + "\n        {appTab === 'AI' && ("
);

// 4. Update Bottom Nav Bar
const bottomNavOld = `
          <button onClick={() => setAppTab('AI')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'AI' ? 'text-purple-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Cpu className="w-5 h-5" />
            <span className="text-[10px] font-bold">AI</span>
          </button>
`;

const bottomNavNew = `
          <button onClick={() => setAppTab('SUPPORT')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'SUPPORT' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Bot className="w-5 h-5" />
            <span className="text-[10px] font-bold">Support</span>
          </button>
`;

if (!code.includes('setAppTab(\'SUPPORT\')')) {
  code = code.replace(bottomNavOld, bottomNavNew);
}

// 5. Ensure Bot icon is imported from lucide
if (!code.includes('Bot,')) {
  code = code.replace('Cpu } from \'lucide-react\';', 'Cpu, Bot } from \'lucide-react\';');
}

fs.writeFileSync('src/App.tsx', code);
