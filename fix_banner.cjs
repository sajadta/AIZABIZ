const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /\{\(\!isWsConnected \|\| \!apiConfig\.accessToken \|\| apiConfig\.accessToken === ''\) && \!showSetupModal && \(/g,
  "{(!apiConfig.accessToken || apiConfig.accessToken === '') && !showSetupModal && ("
);

fs.writeFileSync('src/App.tsx', code);
