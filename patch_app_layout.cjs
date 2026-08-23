const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetLayout = `        {appTab === 'MARKETS' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="w-80 border-r border-[#1d2335] bg-[#0b0f19] flex flex-col hide-scrollbar overflow-y-auto">`;

const replaceLayout = `        {appTab === 'MARKETS' && (
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            <div className="w-full sm:w-80 border-b sm:border-b-0 sm:border-r border-[#1d2335] bg-[#0b0f19] flex flex-col hide-scrollbar overflow-y-auto max-h-[35vh] sm:max-h-none shrink-0">`;

if (code.includes(targetLayout)) {
    code = code.replace(targetLayout, replaceLayout);
    fs.writeFileSync('src/App.tsx', code);
    console.log('App layout patched');
} else {
    console.log('Layout target not found');
}
