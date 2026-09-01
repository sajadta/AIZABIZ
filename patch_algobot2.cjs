const fs = require('fs');
let content = fs.readFileSync('src/components/AlgoBotPanel.tsx', 'utf-8');

// Insert the Diagnostics button in the Tabs area
const target = "          <span>{language === 'ml' ? 'ലോഗ്' : 'Bot Logs'}</span>\n        </button>";
const newButton = `
        <button
          onClick={() => setShowDiagnostics(true)}
          className={\`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap \${
            showDiagnostics
              ? 'border-indigo-400 text-indigo-400'
              : 'border-transparent text-indigo-400/70 hover:text-indigo-300'
          }\`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Diagnostics</span>
        </button>
`;

if (!content.includes('Diagnostics</span>')) {
    content = content.replace(target, target + newButton);
    fs.writeFileSync('src/components/AlgoBotPanel.tsx', content);
    console.log("Button patched.");
}
