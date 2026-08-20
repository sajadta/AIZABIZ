const fs = require('fs');
let code = fs.readFileSync('src/components/Watchlist.tsx', 'utf8');

const filterTarget = `{(['ALL', 'INDEX', 'EQUITY'] as const).map((seg) => (`;
const filterReplacement = `{(['ALL', 'INDEX', 'EQUITY', 'GLOBAL'] as const).map((seg) => (`;

code = code.replace(filterTarget, filterReplacement);
fs.writeFileSync('src/components/Watchlist.tsx', code);
