const fs = require('fs');
let code = fs.readFileSync('src/components/AndroidInstallModal.tsx', 'utf8');

// We don't want to try to use bubblewrap inside AI Studio, so let's simplify the instructions
const regexAPKTab = /\{activeTab === 'APK' && \([\s\S]*?\{activeTab === 'GITHUB'/;
const newAPKTab = `{activeTab === 'APK' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <p className="font-bold text-emerald-400 mb-1">
                  {language === 'ml' ? 'ഒരു .APK ഫയൽ ഉണ്ടാക്കാനുള്ള എളുപ്പവഴി:' : 'How to create a standalone .APK file:'}
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0">1</span>
                    <p className="text-[11px] leading-relaxed">
                      {language === 'ml' 
                        ? 'ആദ്യം മുകളിലുള്ള "Settings" അല്ലെങ്കിൽ "Share" വഴി ഈ ആപ്പ് നിങ്ങളുടെ കമ്പ്യൂട്ടറിലേക്ക് ഡൗൺലോഡ് ചെയ്യുക (അല്ലെങ്കിൽ GitHub ലേക്ക് മാറ്റുക).'
                        : 'First, export or download this app to your computer using the Settings or Share menu.'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0">2</span>
                    <p className="text-[11px] leading-relaxed">
                      {language === 'ml' 
                        ? 'PWABuilder വെബ്സൈറ്റ് (www.pwabuilder.com) തുറക്കുക.'
                        : 'Open the free PWABuilder tool (www.pwabuilder.com).'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-400 shrink-0">3</span>
                    <p className="text-[11px] leading-relaxed">
                      {language === 'ml' 
                        ? 'നിങ്ങളുടെ ആപ്പിന്റെ URL അതിൽ നൽകി "Generate APK" ക്ലിക്ക് ചെയ്താൽ നിമിഷങ്ങൾക്കകം Android/Playstore ആപ്പ് ഡൗൺലോഡ് ചെയ്യാം.'
                        : 'Paste this app\\'s hosted URL there, and click "Generate" to instantly download a ready-to-install Android APK file.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[10px] text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  {language === 'ml' 
                    ? 'AI Studio-ക്കകത്ത് വെച്ച് നേരിട്ട് APK ഫയൽ നിർമ്മിക്കാൻ സാങ്കേതികമായി സാധ്യമല്ല. അതിനാൽ മുകളിലെ മാർഗ്ഗം ഉപയോഗിക്കുക.'
                    : 'Note: AI Studio cannot generate raw .APK binary files directly in the browser environment. Use the simple wrapper method above.'}
                </span>
              </div>
            </div>
          )}
          {activeTab === 'GITHUB'`;

code = code.replace(regexAPKTab, newAPKTab);
fs.writeFileSync('src/components/AndroidInstallModal.tsx', code);
