const fs = require('fs');
let code = fs.readFileSync('src/components/LiveAiSupport.tsx', 'utf-8');
code = code.replace(
  "let errText = 'ഡയഗ്നോസ്റ്റിക്സിൽ പിഴവ് സംഭവിച്ചു (API Error).';",
  "let errText = 'ഡയഗ്നോസ്റ്റിക്സിൽ പിഴവ് സംഭവിച്ചു (API Error). ' + (data.error ? '\\nകാരണം: ' + data.error : '');"
);
code = code.replace(
  "text: 'Error connecting to AI Server. Please try again later.'",
  "text: 'Error: ' + (data.error || 'Server error. Please try again later.')"
);
fs.writeFileSync('src/components/LiveAiSupport.tsx', code);
