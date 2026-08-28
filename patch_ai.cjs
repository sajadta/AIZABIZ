const fs = require('fs');
let code = fs.readFileSync('src/components/LiveAiSupport.tsx', 'utf8');

const targetStr = `      const data = await res.json();
      if (data.success || data.text) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.text }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Error in diagnostics: ' + JSON.stringify(data) }]);
      }`;

const replaceStr = `      const data = await res.json();
      if (data.success || data.text) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.text }]);
      } else {
        let errText = 'ഡയഗ്നോസ്റ്റിക്സിൽ പിഴവ് സംഭവിച്ചു (API Error).';
        if (JSON.stringify(data).includes('503') || JSON.stringify(data).includes('high demand')) {
            errText = 'ക്ഷമിക്കണം, AI സെർവറുകളിൽ ഇപ്പോൾ വലിയ തിരക്കാണ് (High Demand). ദയവായി അല്പസമയം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.';
        }
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: errText }]);
      }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/LiveAiSupport.tsx', code);
console.log("Patched LiveAiSupport.tsx");
