const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '<OptionChainPanel',
  '<OptionChainView'
);
code = code.replace(
  'data={optionChain}',
  'data={optionChainData}'
);
code = code.replace(
  'loading={optionChainLoading}',
  'loading={optionLoading}'
);

fs.writeFileSync('src/App.tsx', code);
