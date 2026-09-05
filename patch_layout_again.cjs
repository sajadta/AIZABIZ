const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  /<div className="h-screen h-\[100dvh\] w-full relative overflow-x-hidden flex flex-col pb-16">/,
  '<div className="h-screen h-[100dvh] w-full relative overflow-x-hidden flex flex-col pb-24">'
);

// Some tabs have "flex-1 overflow-y-auto hide-scrollbar" internally which might stop them from scrolling the body.
// Let's ensure the body is scrollable or the internal ones are padded.

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx layout padding again");
