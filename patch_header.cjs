const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Replace the UPSTOX ALGO PRO name with AIZABIZ
code = code.replace(
  /<span className="text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">\s*UPSTOX <span className="text-emerald-400">ALGO<\/span>\s*<\/span>/g,
  \`<span className="text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">AIZA<span className="text-emerald-400">BIZ</span></span>\`
);

code = code.replace(/PRO v3/g, "PRO");

// Replace the logo Zap icon with the newly generated image
code = code.replace(
  /<div className="w-full h-full bg-\\[#090d16\\] rounded-\\[10px\\] flex items-center justify-center">\s*<Zap className="w-5 h-5 text-amber-400 fill-amber-400" \/>\s*<\/div>/g,
  \`<div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center overflow-hidden">
                <img src="/src/assets/images/aizabiz_logo_1787123141675.jpg" alt="AIZABIZ Logo" className="w-full h-full object-cover" />
              </div>\`
);

fs.writeFileSync('src/components/Header.tsx', code);
