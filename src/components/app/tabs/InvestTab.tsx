import React from 'react';
import { InvestmentPortal } from '../../InvestmentPortal';
import type { Language } from '../../../types';

interface InvestTabProps {
  language: Language;
}

export const InvestTab: React.FC<InvestTabProps> = ({ language }) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-y-auto smooth-scroll pb-28 lg:pb-4">
    <InvestmentPortal language={language} />
  </div>
);
