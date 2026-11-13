import React from 'react';
import { UpstoxApiConfig, Language } from '../types';
import { useUpstoxApiModal } from './upstox/useUpstoxApiModal';
import { UpstoxModalHeader } from './upstox/UpstoxModalHeader';
import { UpstoxTabSelector } from './upstox/UpstoxTabSelector';
import { UpstoxConnectionCard } from './upstox/UpstoxConnectionCard';
import { UpstoxStatusAlert } from './upstox/UpstoxStatusAlert';
import { UpstoxDailyTokenTab } from './upstox/UpstoxDailyTokenTab';
import { UpstoxOtpConnectTab } from './upstox/UpstoxOtpConnectTab';

interface UpstoxApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: UpstoxApiConfig;
  onSaveConfig: (cfg: Partial<UpstoxApiConfig>) => Promise<void>;
  language: Language;
  onRefreshPortfolio?: () => void;
}

export const UpstoxApiModal: React.FC<UpstoxApiModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  language,
  onRefreshPortfolio,
}) => {
  const {
    activeTab,
    setActiveTab,
    apiKey,
    setApiKey,
    apiSecret,
    setApiSecret,
    accessToken,
    setAccessToken,
    redirectUri,
    setRedirectUri,
    savedMobile,
    setSavedMobile,
    otpInput,
    setOtpInput,
    otpRequested,
    showKeySettings,
    setShowKeySettings,
    loading,
    validating,
    checkingStatus,
    v3Loading,
    proxyUrlInput,
    setProxyUrlInput,
    isFixedProxyActive,
    isTestingProxy,
    showProxyConfig,
    setShowProxyConfig,
    containerIp,
    proxyError,
    liveHoldingsCount,
    statusMsg,
    setStatusMsg,
    handleSaveProxy,
    handleCheckLiveConnection,
    handleDailyTokenSubmit,
    handleForceSendSmsOtp,
    handleOtpOrAutoConnect,
    handleClearToken,
    handleRequestTokenV3,
    handleSaveRedirectUri,
    getFallbackRedirectUri,
    DEFAULT_API_KEY,
  } = useUpstoxApiModal({ isOpen, onClose, config, onSaveConfig, language, onRefreshPortfolio });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <UpstoxModalHeader onClose={onClose} language={language} />
        <UpstoxTabSelector activeTab={activeTab} setActiveTab={setActiveTab} language={language} />

        <div className="p-4 sm:p-5 space-y-4">
          <UpstoxConnectionCard
            checkingStatus={checkingStatus}
            proxyUrlInput={proxyUrlInput}
            setProxyUrlInput={setProxyUrlInput}
            isFixedProxyActive={isFixedProxyActive}
            isTestingProxy={isTestingProxy}
            showProxyConfig={showProxyConfig}
            setShowProxyConfig={setShowProxyConfig}
            containerIp={containerIp}
            proxyError={proxyError}
            liveHoldingsCount={liveHoldingsCount}
            setStatusMsg={setStatusMsg}
            handleSaveProxy={handleSaveProxy}
            handleCheckLiveConnection={handleCheckLiveConnection}
            handleClearToken={handleClearToken}
            config={config}
            language={language}
          />

          <UpstoxStatusAlert
            apiKey={apiKey}
            redirectUri={redirectUri}
            statusMsg={statusMsg}
            getFallbackRedirectUri={getFallbackRedirectUri}
            DEFAULT_API_KEY={DEFAULT_API_KEY}
            language={language}
          />

          {activeTab === 'DAILY_TOKEN' && (
            <UpstoxDailyTokenTab
              apiKey={apiKey}
              accessToken={accessToken}
              setAccessToken={setAccessToken}
              redirectUri={redirectUri}
              setRedirectUri={setRedirectUri}
              validating={validating}
              v3Loading={v3Loading}
              handleDailyTokenSubmit={handleDailyTokenSubmit}
              handleRequestTokenV3={handleRequestTokenV3}
              handleSaveRedirectUri={handleSaveRedirectUri}
              getFallbackRedirectUri={getFallbackRedirectUri}
              DEFAULT_API_KEY={DEFAULT_API_KEY}
              onClose={onClose}
              language={language}
            />
          )}

          {activeTab === 'API_KEYS' && (
            <UpstoxOtpConnectTab
              apiKey={apiKey}
              setApiKey={setApiKey}
              apiSecret={apiSecret}
              setApiSecret={setApiSecret}
              savedMobile={savedMobile}
              setSavedMobile={setSavedMobile}
              otpInput={otpInput}
              setOtpInput={setOtpInput}
              otpRequested={otpRequested}
              showKeySettings={showKeySettings}
              setShowKeySettings={setShowKeySettings}
              loading={loading}
              handleForceSendSmsOtp={handleForceSendSmsOtp}
              handleOtpOrAutoConnect={handleOtpOrAutoConnect}
              onClose={onClose}
              language={language}
            />
          )}
        </div>
      </div>
    </div>
  );
};
