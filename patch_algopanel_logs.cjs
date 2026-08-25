const fs = require('fs');
let code = fs.readFileSync('src/components/AlgoBotPanel.tsx', 'utf8');

const oldLogs = `                    log.type === 'SIGNAL' ? 'text-cyan-400' :
                    log.type === 'EXECUTION' ? 'text-emerald-400' :
                    log.type === 'SL_TRIGGER' ? 'text-rose-400' :
                    log.type === 'TP_TRIGGER' ? 'text-amber-400' :
                    log.type === 'ERROR' ? 'text-red-400 font-black' : 'text-slate-400'`;

const newLogs = `                    log.type === 'SIGNAL' ? 'text-cyan-400' :
                    (log.type === 'EXECUTION' || log.type === 'TRADE') ? 'text-blue-400' :
                    (log.type === 'SL_TRIGGER' || log.type === 'ERROR') ? 'text-rose-400' :
                    (log.type === 'TP_TRIGGER' || log.type === 'SUCCESS') ? 'text-emerald-400 font-bold' :
                    'text-slate-400'`;

code = code.replace(oldLogs, newLogs);
fs.writeFileSync('src/components/AlgoBotPanel.tsx', code);
console.log('Patched AlgoBotPanel logs');
