const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Use regex to find fetch calls to Upstox and add Api-Version to headers
const regex = /(fetch\([\s\S]*?https:\/\/api\.upstox\.com[\s\S]*?headers:\s*\{)([\s\S]*?)(\})/gm;

let match;
let fixedCode = code;

code.replace(regex, (fullMatch, startMatch, innerHeaders, endMatch) => {
    if (!innerHeaders.includes('Api-Version')) {
        const replacement = `${startMatch}${innerHeaders.trim() ? innerHeaders + ", " : ""}'Api-Version': '2.0'${endMatch}`;
        fixedCode = fixedCode.replace(fullMatch, replacement);
    }
});

fs.writeFileSync('server.ts', fixedCode);
console.log('Fixed headers in server.ts');
