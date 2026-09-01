const fs = require('fs');
let wlStr = fs.readFileSync('src/components/Watchlist.tsx', 'utf-8');
if (!wlStr.includes(", X } from 'lucide-react'")) {
    wlStr = wlStr.replace("} from 'lucide-react';", ", X } from 'lucide-react';");
}
fs.writeFileSync('src/components/Watchlist.tsx', wlStr);
