const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(/{activeTab === 'bot' && \(/g, "{appTab === 'PORTFOLIO' && (");
code = code.replace(/botHistory/g, "tradeHistory");
code = code.replace(/<TradingChart data={chartData} \/>/, "<TradingChart data={[]} />"); // since chartData wasn't injected correctly

if (!code.includes("import { AdvancedAnalytics }")) {
    code = code.replace(/import \{ TradingChart \} from '\.\/components\/TradingChart';/, "import { TradingChart } from './components/TradingChart';\nimport { AdvancedAnalytics } from './components/AdvancedAnalytics';");
}
if (!code.includes("import { TradingChart }")) {
    code = code.replace(/import \{ AlgoBotPanel \} from '\.\/components\/AlgoBotPanel';/, "import { AlgoBotPanel } from './components/AlgoBotPanel';\nimport { TradingChart } from './components/TradingChart';");
    code = code.replace(/import \{ AlgoBotPanel \} from '\.\/components\/AlgoBotPanel';/, "import { AlgoBotPanel } from './components/AlgoBotPanel';\nimport { AdvancedAnalytics } from './components/AdvancedAnalytics';");
}
fs.writeFileSync('src/App.tsx', code);
