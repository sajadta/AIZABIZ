// Explainer drawer describing how the index + option-premium selector works.
import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Language } from '../../../types';

interface IndexIntelligenceDrawerProps {
  language: Language;
}

export const IndexIntelligenceDrawer: React.FC<IndexIntelligenceDrawerProps> = ({ language }) => (
  <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-800/50 space-y-3 animate-in fade-in duration-200">
    <div className="flex items-center gap-2 text-cyan-300 font-black text-xs">
      <Sparkles className="w-4 h-4 text-cyan-400" />
      <span>
        {language === 'ml'
          ? 'ഇൻഡക്സ് ഓപ്ഷൻ പ്രീമിയം സെലക്ഷൻ അൽഗോരിതം വിശദീകരണം'
          : 'Institutional Index & Option Premium Selection Intelligence'}
      </span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px] text-slate-300">
      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-1.5">
        <span className="font-extrabold text-white text-xs block text-emerald-400">
          {language === 'ml'
            ? '1. ഏതൊക്കെ ഇൻഡക്സുകളാണ് ട്രേഡ് ചെയ്യുന്നത്?'
            : '1. Which Indices Are Traded?'}
        </span>
        <p className="text-[10px] text-slate-300 leading-relaxed">
          {language === 'ml'
            ? 'ഇന്ത്യൻ മാർക്കറ്റിലെ 6 പ്രമുഖ ഇൻഡക്സുകളും പൂർണ്ണമായി സപ്പോർട്ട് ചെയ്യുന്നു:'
            : 'Full tick-by-tick real execution support for all 6 benchmark Indian indices:'}
        </p>
        <ul className="text-[10px] space-y-1 text-slate-300 list-disc list-inside">
          <li>
            <strong>NIFTY 50</strong> (NSE | Lot: 25 | Expiry: വ്യാഴം / Thu)
          </li>
          <li>
            <strong>BANKNIFTY</strong> (NSE | Lot: 15 | Expiry: ബുധൻ / Wed)
          </li>
          <li>
            <strong>SENSEX</strong> (BSE | Lot: 10 | Expiry: വെള്ളി / Fri)
          </li>
          <li>
            <strong>FINNIFTY</strong> (NSE | Lot: 25 | Expiry: ചൊവ്വ / Tue)
          </li>
          <li>
            <strong>MIDCPNIFTY</strong> (NSE | Lot: 50 | Expiry: തിങ്കൾ / Mon)
          </li>
          <li>
            <strong>BANKEX</strong> (BSE | Lot: 15 | Expiry: തിങ്കൾ / Mon)
          </li>
        </ul>
      </div>
      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-1.5">
        <span className="font-extrabold text-white text-xs block text-cyan-400">
          {language === 'ml'
            ? '2. എങ്ങനെയാണ് ഏറ്റവും ഉയർന്ന ലാഭമുള്ള ഓപ്ഷൻ പ്രീമിയം കണ്ടെത്തുന്നത്?'
            : '2. How Does Algo Find the Most Profitable Option Premium?'}
        </span>
        <ul className="text-[10px] space-y-1 text-slate-300 list-disc list-inside">
          <li>
            <strong>
              {language === 'ml' ? 'മൾട്ടി-ടൈംഫ്രെയിം കൺഫ്ലുവെൻസ്:' : 'MTF Confluence:'}
            </strong>{' '}
            {language === 'ml'
              ? '15m + 5m സ്ട്രക്ച്ചറും കോർപ്പറേറ്റ് ഫ്ലോയും തുല്യമായി ഒത്തുചേരുമ്പോൾ മാത്രം.'
              : '15m + 5m trend and institutional heavyweights must agree.'}
          </li>
          <li>
            <strong>
              {language === 'ml' ? 'ഹൈ-ഗാമ ATM സ്വീറ്റ് സ്പോട്ട്:' : 'High-Gamma ATM Sweet Spot:'}
            </strong>{' '}
            {language === 'ml'
              ? 'ഡെൽറ്റ 0.45–0.62 ഉള്ള ATM/ITM ഓപ്ഷനുകൾ (ഡീപ് OTM തീറ്റ നഷ്ടം 0% ഒഴിവാക്കുന്നു).'
              : 'ATM/ITM strikes with Delta 0.45–0.62 capture 100% gamma expansion.'}
          </li>
          <li>
            <strong>
              {language === 'ml' ? '1m കാൻഡിൽ പ്രീമിയം വേഗത:' : '1m Option Momentum:'}
            </strong>{' '}
            {language === 'ml'
              ? 'ഓപ്ഷൻ പ്രീമിയത്തിന്റെ കാൻഡിൽ പച്ചയായി മുകളിലേക്ക് കുതിക്കുന്നുണ്ടെന്ന് ഉറപ്പാക്കുന്നു.'
              : 'Option candle itself must be green and expanding upward.'}
          </li>
          <li>
            <strong>
              {language === 'ml' ? 'ബ്രോക്കറേജ് പ്രൊട്ടക്ഷൻ ഷീൽഡ്:' : 'Anti-Brokerage Protection:'}
            </strong>{' '}
            {language === 'ml'
              ? '₹40 ബ്രോക്കറേജ് കഴിഞ്ഞ് മിനിമം +₹350 മുതൽ +₹1,500 വരെ അറ്റാദായം ഉറപ്പുള്ളത് മാത്രം.'
              : 'Requires net profit buffer (+₹350–₹1,500) above all roundtrip brokerage & taxes.'}
          </li>
        </ul>
      </div>
    </div>
  </div>
);
