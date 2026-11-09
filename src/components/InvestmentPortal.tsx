import React from 'react';
import { 
  PiggyBank, 
  TrendingUp, 
  ArrowRight, 
  Globe, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Rocket, 
  BarChart2 
} from 'lucide-react';
import { Language } from '../types';

interface InvestmentPortalProps {
  language: Language;
}

export const InvestmentPortal: React.FC<InvestmentPortalProps> = ({ language }) => {
  const isMl = language === 'ml';

  const segments = [
    {
      title: isMl ? 'മ്യൂച്വൽ ഫണ്ടുകൾ' : 'Mutual Funds',
      description: isMl 
        ? 'പ്രതിമാസം ചെറിയ തുക മുതൽ വൻകിട കമ്പനികളിൽ നിക്ഷേപിക്കാം.' 
        : 'Invest in professionally managed funds starting with small monthly SIPs.',
      icon: <PiggyBank className="w-6 h-6 text-emerald-400" />,
      link: 'https://upstox.com/mutual-funds/',
      stats: isMl ? '4,500+ ഫണ്ടുകൾ ലഭ്യമാണ്' : '4,500+ Funds Available',
      badge: isMl ? 'സീറോ കമ്മീഷൻ' : 'Zero Commission'
    },
    {
      title: isMl ? 'IPO (പുതിയ ഓഹരികൾ)' : 'Initial Public Offerings (IPO)',
      description: isMl 
        ? 'പുതിയ കമ്പനികൾ വിപണിയിലെത്തുമ്പോൾ ഓഹരികൾ മുൻകൂട്ടി വാങ്ങാം.' 
        : 'Get early access to shares of promising companies before they hit the market.',
      icon: <Rocket className="w-6 h-6 text-indigo-400" />,
      link: 'https://upstox.com/ipo/',
      stats: isMl ? 'ഇപ്പോൾ അപ്ലൈ ചെയ്യാം' : 'Apply Now',
      badge: isMl ? 'ഹൈ ഡിമാൻഡ്' : 'High Demand'
    },
    {
      title: isMl ? 'യുഎസ് മാർക്കറ്റ് (US Stocks)' : 'US Markets (Global Stocks)',
      description: isMl 
        ? 'ആപ്പിൾ, ഗൂഗിൾ, ടെസ്‌ല തുടങ്ങിയ ലോകോത്തര കമ്പനികളിൽ നേരിട്ട് നിക്ഷേപിക്കാം.' 
        : 'Directly invest in global giants like Apple, Google, Tesla, and Amazon.',
      icon: <Globe className="w-6 h-6 text-cyan-400" />,
      link: 'https://upstox.com/us-stocks/',
      stats: isMl ? 'NASDAQ & NYSE' : 'NASDAQ & NYSE',
      badge: isMl ? 'ഗ്ലോബൽ' : 'Global'
    },
    {
      title: isMl ? 'ഗോൾഡ് & ബോണ്ടുകൾ' : 'Gold & Bonds',
      description: isMl 
        ? 'ഡിജിറ്റൽ ഗോൾഡ് വഴിയും ഗവൺമെന്റ് ബോണ്ടുകൾ വഴിയും സുരക്ഷിതമായ നിക്ഷേപം.' 
        : 'Secure your future with Digital Gold and Government-backed Sovereign Bonds.',
      icon: <ShieldCheck className="w-6 h-6 text-amber-400" />,
      link: 'https://upstox.com/digital-gold/',
      stats: isMl ? '99.9% പ്യൂരിറ്റി' : '99.9% Purity',
      badge: isMl ? 'സുരക്ഷിതം' : 'Secure'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
            <Zap className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              {isMl ? 'നിക്ഷേപ പ്ലാറ്റ്‌ഫോം' : 'Smart Investment Hub'}
            </h2>
            <p className="text-slate-400 text-sm">
              {isMl 
                ? 'അപ്സ്റ്റോക്സ് നൽകുന്ന എല്ലാ നിക്ഷേപ സേവനങ്ങളും ഇപ്പോൾ നിങ്ങളുടെ വിരൽത്തുമ്പിൽ.' 
                : 'Access all Upstox investment services directly from your pro terminal.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {segments.map((s, idx) => (
            <a 
              key={idx}
              href={s.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                {s.icon}
              </div>
              
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  {s.icon}
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-900 text-slate-400 border border-slate-800 group-hover:border-indigo-500/30 group-hover:text-indigo-400">
                  {s.badge}
                </span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                {s.title}
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
              </h3>
              
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                {s.description}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {s.stats}
                </span>
                <div className="flex items-center gap-1 text-indigo-400 text-xs font-bold group-hover:translate-x-1 transition-transform">
                  <span>{isMl ? 'തുടങ്ങാം' : 'Invest Now'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Institutional Learning Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-900/20 to-slate-950 border border-indigo-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">{isMl ? 'വിപണി വിശകലനം' : 'Institutional Market Insights'}</h3>
          </div>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            {isMl 
              ? 'മാർക്കറ്റിലെ പുതിയ ട്രെൻഡുകളും വിദഗ്ദ്ധരുടെ നിക്ഷേപ നിർദ്ദേശങ്ങളും ഇവിടെ കാണാം. നിങ്ങളുടെ നിക്ഷേപങ്ങൾ ശരിയായ ദിശയിലാണെന്ന് ഉറപ്പാക്കുക.' 
              : 'Stay ahead with institutional-grade market reports and expert investment insights curated specifically for pro traders.'}
          </p>
          <button className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-950/40">
            <FileText className="w-4 h-4" />
            <span>{isMl ? 'റിപ്പോർട്ടുകൾ കാണുക' : 'View Market Reports'}</span>
          </button>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">{isMl ? 'സമ്പാദ്യം' : 'Wealth Builder'}</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              {isMl 
                ? 'നിങ്ങളുടെ റിസ്കിന് അനുയോജ്യമായ ഏറ്റവും മികച്ച നിക്ഷേപ പദ്ധതികൾ കണ്ടെത്തുക.' 
                : 'Find the perfect investment portfolio tailored to your risk profile and financial goals.'}
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isMl ? 'ആരംഭിക്കൂ' : 'Get Started'}</span>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
