import React from 'react';
import { OrderModal } from '../OrderModal';
import { UpstoxApiModal } from '../UpstoxApiModal';
import { AlertsModal } from '../AlertsModal';
import { AndroidInstallModal } from '../AndroidInstallModal';
import { OnboardingSetupModal } from '../OnboardingSetupModal';
import { MasterPinLockModal } from '../MasterPinLockModal';
import type { BotConfig, ExecutionMode, Language, PriceAlert, UpstoxApiConfig } from '../../types';
import type { OrderModalData, PlaceOrderInput } from './types';

interface AppModalsProps {
  isOrderModalOpen: boolean;
  setIsOrderModalOpen: (v: boolean) => void;
  orderModalData: OrderModalData;
  apiConfig: UpstoxApiConfig;
  botConfig: BotConfig;
  mode: ExecutionMode;
  handlePlaceOrder: (orderData: PlaceOrderInput) => Promise<void>;
  language: Language;
  isApiModalOpen: boolean;
  setIsApiModalOpen: (v: boolean) => void;
  fetchHoldings: () => Promise<void>;
  fetchLivePositions: () => Promise<void>;
  setApiConfig: React.Dispatch<React.SetStateAction<UpstoxApiConfig>>;
  isAlertsModalOpen: boolean;
  priceAlerts: PriceAlert[];
  setIsAlertsModalOpen: (v: boolean) => void;
  handleAddAlert: (
    symbol: string,
    instrumentKey: string,
    targetPrice: number,
    condition: 'GREATER_THAN' | 'LESS_THAN',
  ) => void;
  handleRemoveAlert: (id: string) => void;
  isAndroidModalOpen: boolean;
  setIsAndroidModalOpen: (v: boolean) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (v: boolean) => void;
  isTerminalLocked: boolean;
  setIsTerminalLocked: (v: boolean) => void;
  paperAccountBalance?: number;
}

export const AppModals: React.FC<AppModalsProps> = ({
  isOrderModalOpen,
  setIsOrderModalOpen,
  orderModalData,
  apiConfig,
  botConfig,
  mode,
  handlePlaceOrder,
  language,
  isApiModalOpen,
  setIsApiModalOpen,
  fetchHoldings,
  fetchLivePositions,
  setApiConfig,
  isAlertsModalOpen,
  priceAlerts,
  setIsAlertsModalOpen,
  handleAddAlert,
  handleRemoveAlert,
  isAndroidModalOpen,
  setIsAndroidModalOpen,
  isOnboardingOpen,
  setIsOnboardingOpen,
  isTerminalLocked,
  setIsTerminalLocked,
  paperAccountBalance = 10000,
}) => (
  <>
    <OrderModal
      isOpen={isOrderModalOpen}
      onClose={() => setIsOrderModalOpen(false)}
      symbol={orderModalData.symbol}
      instrumentKey={orderModalData.instrumentKey}
      defaultPrice={orderModalData.price}
      initialType={orderModalData.type}
      defaultQuantity={orderModalData.quantity}
      defaultLotSize={orderModalData.lotSize}
      heldQuantity={orderModalData.heldQuantity}
      defaultProductType={orderModalData.productType}
      availableMargin={mode === 'PAPER_TRADING' ? paperAccountBalance : apiConfig.availableMargin}
      maxCapitalPerTrade={botConfig.maxCapitalPerTrade}
      mode={mode}
      onPlaceOrder={handlePlaceOrder}
      language={language}
    />

    <UpstoxApiModal
      isOpen={isApiModalOpen}
      onClose={() => setIsApiModalOpen(false)}
      config={apiConfig}
      onRefreshPortfolio={() => {
        fetchHoldings();
        fetchLivePositions();
      }}
      onSaveConfig={async (cfg) => {
        setApiConfig((prev) => ({ ...prev, ...cfg }));
        if (cfg.isConnected) {
          setTimeout(() => {
            fetchHoldings();
            fetchLivePositions();
          }, 300);
        }
        try {
          await fetch('/api/market/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg),
          });
        } catch {
          // Ignored
        }
      }}
      language={language}
    />

    <AlertsModal
      isOpen={isAlertsModalOpen}
      priceAlerts={priceAlerts}
      onClose={() => setIsAlertsModalOpen(false)}
      onAddAlert={handleAddAlert}
      onRemoveAlert={handleRemoveAlert}
      language={language}
    />

    <AndroidInstallModal
      isOpen={isAndroidModalOpen}
      onClose={() => setIsAndroidModalOpen(false)}
      language={language}
    />

    <OnboardingSetupModal
      isOpen={isOnboardingOpen}
      onClose={() => setIsOnboardingOpen(false)}
      defaultBotConfig={botConfig}
      defaultApiConfig={apiConfig}
      language={language}
      onSave={(cfg) => {
        setApiConfig((prev) => ({ ...prev, ...cfg }));
        setIsOnboardingOpen(false);
      }}
    />

    <MasterPinLockModal
      isLocked={isTerminalLocked}
      onUnlock={() => setIsTerminalLocked(false)}
      language={language}
    />
  </>
);
