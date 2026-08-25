const fs = require('fs');
let code = fs.readFileSync('src/components/Watchlist.tsx', 'utf8');

const oldButtons = `<button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderModal('BUY', q.symbol, q.ltp);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[10px] font-black transition border border-emerald-500/30 shadow-sm active:scale-95"
                  >
                    {t.quickBuy}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderModal('SELL', q.symbol, q.ltp);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-black transition border border-rose-500/30 shadow-sm active:scale-95"
                  >
                    {t.quickSell}
                  </button>`;

const newButtons = `{q.segment === 'INDEX' ? (
                   <span className="text-[10px] text-slate-500 italic mr-2">{language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ ഉപയോഗിക്കുക' : 'Trade via Options'}</span>
                  ) : (
                  <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderModal('BUY', q.symbol, q.ltp);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[10px] font-black transition border border-emerald-500/30 shadow-sm active:scale-95"
                  >
                    {t.quickBuy}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenOrderModal('SELL', q.symbol, q.ltp);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-black transition border border-rose-500/30 shadow-sm active:scale-95"
                  >
                    {t.quickSell}
                  </button>
                  </>
                  )}`;

code = code.replace(oldButtons, newButtons);
fs.writeFileSync('src/components/Watchlist.tsx', code);
console.log('Patched Watchlist');
