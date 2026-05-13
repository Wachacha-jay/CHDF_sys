import React, { createContext, useContext } from 'react';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { BusinessSettings } from '../types';

interface SettingsContextType {
  settings: BusinessSettings | null;
  loading: boolean;
  updateSettings: (updates: Partial<BusinessSettings>) => Promise<{ success: boolean; error?: string }>;
  uploadLogo: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  uploadFavicon: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const settingsHook = useBusinessSettings();

  const value: SettingsContextType = {
    settings: settingsHook.settings,
    loading: settingsHook.loading,
    updateSettings: settingsHook.updateSettings,
    uploadLogo: settingsHook.uploadLogo as any,
    uploadFavicon: settingsHook.uploadFavicon as any,
    refreshSettings: settingsHook.refetch,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};
