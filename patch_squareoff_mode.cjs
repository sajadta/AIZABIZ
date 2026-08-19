const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "      const res = await fetch(`/api/trading/squareoff/${positionId}`, {\n        method: 'POST',\n      });",
  "      const res = await fetch(`/api/trading/squareoff/${positionId}`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ mode })\n      });"
);

code = code.replace(
  "      const res = await fetch('/api/trading/squareoff-all', {\n        method: 'POST',\n      });",
  "      const res = await fetch('/api/trading/squareoff-all', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ mode })\n      });"
);

fs.writeFileSync('src/App.tsx', code);
