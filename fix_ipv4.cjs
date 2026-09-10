const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const ipv4Code = `import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
`;

if (!code.includes('ipv4first')) {
  // Find a good place to insert, e.g. after the last import
  const lines = code.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      lastImportIdx = i;
    }
  }
  
  lines.splice(lastImportIdx + 1, 0, ipv4Code);
  fs.writeFileSync('server.ts', lines.join('\n'));
  console.log('Fixed IPv4');
}
