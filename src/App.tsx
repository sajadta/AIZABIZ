import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, AlertCircle } from 'lucide-react';

const App = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-white">Mobile Trading App</h1>
        <p className="text-slate-400">
          Your seamless mobile trading experience. Install the app to your home screen for quick access.
        </p>

        {!isInstalled && isInstallable && (
          <button
            onClick={install}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-4 rounded-xl font-bold transition"
          >
            <Download className="w-5 h-5" />
            Install App
          </button>
        )}

        {!isInstalled && isIOS && (
          <div>
            <button
              onClick={() => setShowIOSGuide(true)}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-xl font-bold transition"
            >
              <Download className="w-5 h-5" />
              Install on iOS
            </button>

            {showIOSGuide && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
                <div className="w-full max-w-sm rounded-2xl bg-slate-800 p-6 shadow-2xl border border-slate-700">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-6 h-6 text-indigo-400" />
                    <h3 className="text-lg font-bold text-white">Install on iPhone / iPad</h3>
                  </div>
                  <div className="space-y-4 text-slate-300">
                    <p className="flex gap-2">
                      <span className="font-bold text-white">1.</span>
                      <span>Tap the <strong>Share</strong> button in Safari toolbar at the bottom.</span>
                    </p>
                    <p className="flex gap-2">
                      <span className="font-bold text-white">2.</span>
                      <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setShowIOSGuide(false)}
                    className="mt-6 w-full rounded-xl bg-slate-700 py-3 text-sm font-bold text-white hover:bg-slate-600 transition"
                  >
                    Close Guide
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isInstalled && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl">
            App is successfully installed! You can now launch it from your home screen.
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
