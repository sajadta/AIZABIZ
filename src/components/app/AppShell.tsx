// Layout frame for the app: full-height dark page that hosts chrome, workspace and overlays.
import React from 'react';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-[100dvh] max-h-[100dvh] w-full max-w-full bg-[#070a12] text-slate-100 overflow-hidden font-sans select-none">
    {children}
  </div>
);

export default AppShell;
