const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// For lines that start with headers: { and end with 'Api-Version': '2.0', we add }
code = code.replace(/headers:\s*\{\s*'Authorization'[^}]*'Api-Version':\s*'2\.0',?/g, (match) => {
    return match.replace(/,?\s*$/, ' }');
});
code = code.replace(/headers:\s*\{\s*'Accept'[^}]*'Api-Version':\s*'2\.0',?/g, (match) => {
    return match.replace(/,?\s*$/, ' }');
});

fs.writeFileSync('server.ts', code);
console.log('Fixed one-line headers');
