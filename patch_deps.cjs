const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/}, \[\]\);\n\n  \/\/ 2\. Fetch Candlestick History/g, '}, [apiConfig.accessToken]);\n\n  // 2. Fetch Candlestick History');
code = code.replace(/  \}, \[\]\);\n\n  \/\/ 3\. Fetch Positions \& Orders/g, '  }, [apiConfig.accessToken]);\n\n  // 3. Fetch Positions & Orders');
code = code.replace(/  \}, \[mode\]\);\n\n  \/\/ 4\. Option Chain/g, '  }, [mode, apiConfig.accessToken]);\n\n  // 4. Option Chain');
code = code.replace(/  \}, \[language\]\);\n\n  \/\/ 5\. Check Token \& State/g, '  }, [language, apiConfig.accessToken]);\n\n  // 5. Check Token & State');

fs.writeFileSync('src/App.tsx', code);
console.log("Patched hook dependencies");
