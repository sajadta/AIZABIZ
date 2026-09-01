const fs = require('fs');
let content = fs.readFileSync('src/components/AlgoBotPanel.tsx', 'utf-8');

if (!content.includes('DiagnosticsModal')) {
    content = content.replace("import { translations } from '../translations';", "import { translations } from '../translations';\nimport { DiagnosticsModal } from './DiagnosticsModal';");
    content = content.replace("const [scanMessageIndex, setScanMessageIndex] = useState(0);", "const [scanMessageIndex, setScanMessageIndex] = useState(0);\n  const [showDiagnostics, setShowDiagnostics] = useState(false);");
    
    // Add button in the top tab bar area.
    const tabsTarget = `<button            onClick={() => setActiveTab('LOGS')}`;
    const diagButton = `
          <button
            onClick={() => setShowDiagnostics(true)}
            className="flex-1 py-2 text-xs font-bold rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-800"
          >
            Diagnostics
          </button>
    `;
    
    content = content.replace(tabsTarget, diagButton + tabsTarget);
    
    // Add the modal at the end before final div
    content = content.replace(/<\/div>\s*$/g, `
      {showDiagnostics && <DiagnosticsModal onClose={() => setShowDiagnostics(false)} language={language} />}
    </div>`);

    fs.writeFileSync('src/components/AlgoBotPanel.tsx', content);
}
