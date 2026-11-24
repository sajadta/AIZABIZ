import React from 'react';
import { Header } from '../Header';
import { TickerBar } from '../TickerBar';
import { AppTopSections } from './AppTopSections';
import { AppInspectionBanner } from './AppInspectionBanner';
import { AppIpWhitelistNotice } from './AppIpWhitelistNotice';

type HeaderProps = React.ComponentProps<typeof Header>;
type TickerBarProps = React.ComponentProps<typeof TickerBar>;
type TopSectionsProps = React.ComponentProps<typeof AppTopSections>;
type IpNoticeProps = React.ComponentProps<typeof AppIpWhitelistNotice>;
type InspectionProps = React.ComponentProps<typeof AppInspectionBanner>;

interface AppChromeProps {
  header: Omit<
    HeaderProps,
    'setMode' | 'onOpenApiSettings' | 'onOpenAndroidModal' | 'onOpenAlerts' | 'onToggleBot'
  >;
  onModeChange: HeaderProps['setMode'];
  onOpenApiSettings: () => void;
  onOpenAndroidModal: () => void;
  onOpenAlerts: () => void;
  onToggleBot: () => void;
  topSections: TopSectionsProps;
  tickerBar: TickerBarProps;
  inspection: InspectionProps;
  ipNotice: Omit<IpNoticeProps, 'setIsApiModalOpen'>;
  onOpenApiModal: () => void;
}

export const AppChrome: React.FC<AppChromeProps> = ({
  header,
  onModeChange,
  onOpenApiSettings,
  onOpenAndroidModal,
  onOpenAlerts,
  onToggleBot,
  topSections,
  tickerBar,
  inspection,
  ipNotice,
  onOpenApiModal,
}) => (
  <>
    <Header
      {...header}
      setMode={onModeChange}
      onOpenApiSettings={onOpenApiSettings}
      onOpenAndroidModal={onOpenAndroidModal}
      onOpenAlerts={onOpenAlerts}
      onToggleBot={onToggleBot}
    />

    <AppTopSections {...topSections} />

    <TickerBar {...tickerBar} />

    <AppInspectionBanner {...inspection} />

    <AppIpWhitelistNotice {...ipNotice} setIsApiModalOpen={onOpenApiModal} />
  </>
);
