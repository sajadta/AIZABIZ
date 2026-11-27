import React from 'react';
import { Watchlist } from '../Watchlist';
import { AppDesktopNav } from './AppDesktopNav';
import { AppTabContent } from './AppTabContent';

type TabContentProps = React.ComponentProps<typeof AppTabContent>;
type DesktopNavProps = React.ComponentProps<typeof AppDesktopNav>;

interface AppWorkspaceProps {
  quotes: React.ComponentProps<typeof Watchlist>['quotes'];
  selectedSymbol: string;
  setSelectedSymbol: (v: string) => void;
  setSelectedInstrumentKey: (v: string) => void;
  language: TabContentProps['language'];
  setOrderModalData: TabContentProps['setOrderModalData'];
  setIsOrderModalOpen: (v: boolean) => void;
  priceAlerts: TabContentProps['priceAlerts'];
  handleAddAlert: TabContentProps['handleAddAlert'];
  handleRemoveAlert: TabContentProps['handleRemoveAlert'];
  desktopNav: Omit<DesktopNavProps, 'setIsOrderModalOpen' | 'setOrderModalData'>;
  tabContent: Omit<
    TabContentProps,
    | 'quotes'
    | 'selectedSymbol'
    | 'setSelectedSymbol'
    | 'setSelectedInstrumentKey'
    | 'language'
    | 'setOrderModalData'
    | 'setIsOrderModalOpen'
    | 'priceAlerts'
    | 'handleAddAlert'
    | 'handleRemoveAlert'
  >;
}

export const AppWorkspace: React.FC<AppWorkspaceProps> = ({
  quotes,
  selectedSymbol,
  setSelectedSymbol,
  setSelectedInstrumentKey,
  language,
  setOrderModalData,
  setIsOrderModalOpen,
  priceAlerts,
  handleAddAlert,
  handleRemoveAlert,
  desktopNav,
  tabContent,
}) => (
  <div className="flex flex-1 w-full max-w-full min-w-0 min-h-0 overflow-hidden">
    <div className="hidden lg:flex w-72 border-r border-slate-800/80 bg-slate-950/40 p-3 flex-col shrink-0 min-h-0">
      <Watchlist
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={(sym, key) => {
          setSelectedSymbol(sym);
          if (key) setSelectedInstrumentKey(key);
        }}
        language={language}
        onOpenOrderModal={(type, sym, prc) => {
          setOrderModalData({ symbol: sym, price: prc, type });
          setIsOrderModalOpen(true);
        }}
        priceAlerts={priceAlerts}
        onAddAlert={handleAddAlert}
        onRemoveAlert={handleRemoveAlert}
      />
    </div>

    <div className="flex-1 flex flex-col w-full max-w-full min-w-0 min-h-0 overflow-hidden p-1 sm:p-3">
      <AppDesktopNav
        {...desktopNav}
        setIsOrderModalOpen={setIsOrderModalOpen}
        setOrderModalData={setOrderModalData}
      />

      <AppTabContent
        {...tabContent}
        quotes={quotes}
        selectedSymbol={selectedSymbol}
        setSelectedSymbol={setSelectedSymbol}
        setSelectedInstrumentKey={setSelectedInstrumentKey}
        language={language}
        setOrderModalData={setOrderModalData}
        setIsOrderModalOpen={setIsOrderModalOpen}
        priceAlerts={priceAlerts}
        handleAddAlert={handleAddAlert}
        handleRemoveAlert={handleRemoveAlert}
      />
    </div>
  </div>
);
