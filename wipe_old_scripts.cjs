const fs = require('fs');

try {
  fs.unlinkSync('fix_quotes_syntax.cjs');
  fs.unlinkSync('fix_server_data.cjs');
  fs.unlinkSync('test_upstox.cjs');
} catch (e) {}
