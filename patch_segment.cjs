const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Fix segment in 3 places where quotes are generated

code = code.replace(
  /list\.push\(\{[\s\S]*?symbol:\s*symbolDisplay,/g,
  `const segment = key.includes('INDEX') ? 'INDEX' : (key.includes('FO') ? 'OPTIONS' : 'EQUITY');\n         $& \n             segment,`
);

code = code.replace(
  /return \{\s*symbol:\s*symbolDisplay,/g,
  `const segment = key.includes('INDEX') ? 'INDEX' : (key.includes('FO') ? 'OPTIONS' : 'EQUITY');\n                    $& \n                        segment,`
);

code = code.replace(
  /quotesList\.push\(\{\s*symbol:\s*symbolDisplay,/g,
  `const segment = key.includes('INDEX') ? 'INDEX' : (key.includes('FO') ? 'OPTIONS' : 'EQUITY');\n                           $& \n                               segment,`
);

fs.writeFileSync('server.ts', code);
console.log("Patched segments in server.ts");
