const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  "  }, []);\n\n  // 4. Fetch Bot Config",
  "  }, [mode]);\n\n  // 4. Fetch Bot Config"
);

fs.writeFileSync('src/App.tsx', code);
