import React from 'react';
import { AppMobileNav } from './AppMobileNav';
import { AppModals } from './AppModals';
import { AppConfirmDialogs } from './AppConfirmDialogs';

type MobileNavProps = React.ComponentProps<typeof AppMobileNav>;
type ModalsProps = React.ComponentProps<typeof AppModals>;
type ConfirmProps = React.ComponentProps<typeof AppConfirmDialogs>;

interface AppOverlaysProps {
  mobileNav: MobileNavProps;
  modals: ModalsProps;
  confirmDialogs: ConfirmProps;
}

/** Bottom navigation, modal stack and confirmation dialogs of the app shell. */
export const AppOverlays: React.FC<AppOverlaysProps> = ({ mobileNav, modals, confirmDialogs }) => (
  <>
    <AppMobileNav {...mobileNav} />
    <AppModals {...modals} />
    <AppConfirmDialogs {...confirmDialogs} />
  </>
);
