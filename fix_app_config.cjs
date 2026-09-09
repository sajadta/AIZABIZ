const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /const updated = await res\.json\(\);\n          setApiConfig\(updated\);\n          localStorage\.setItem\('algoTradingConfig', JSON\.stringify\(updated\)\);/g,
  `const updated = await res.json();\n          const finalConfig = { ...tempConfig, ...updated };\n          setApiConfig(finalConfig);\n          localStorage.setItem('algoTradingConfig', JSON.stringify(finalConfig));`
);

code = code.replace(
  /const updated = await res\.json\(\);\n    setApiConfig\(updated\);/g,
  `const updated = await res.json();\n    setApiConfig({ ...merged, ...updated });`
);

fs.writeFileSync('src/App.tsx', code);
