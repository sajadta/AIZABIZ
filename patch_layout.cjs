const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `    <div className="h-screen w-full bg-[#0b0f19] text-white flex flex-col font-sans overflow-hidden">`;
const replace1 = `    <div className="h-screen w-full bg-[#0b0f19] text-white flex flex-col font-sans overflow-hidden max-w-[100vw]">`;

if (code.includes(target1)) {
    code = code.replace(target1, replace1);
    fs.writeFileSync('src/App.tsx', code);
    console.log('App wrapper overflow fixed');
} else {
    console.log('Target 1 not found');
}
