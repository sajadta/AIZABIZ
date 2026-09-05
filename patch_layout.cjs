const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /<div className="h-screen h-\[100dvh\] w-full relative overflow-x-hidden">/,
  '<div className="h-screen h-[100dvh] w-full relative overflow-x-hidden flex flex-col pb-16">'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx layout padding");
