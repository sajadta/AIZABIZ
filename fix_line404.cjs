const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /'Accept': 'application\/json', 'Api-Version': '2\.0' \}\s*body: params\.toString\(\),/m;
const replacement = `'Accept': 'application/json', 'Api-Version': '2.0'
      },
      body: params.toString(),`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code);
  console.log('Fixed line 404');
} else {
  console.log('Regex failed');
}
