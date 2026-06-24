import { useState, useEffect } from 'react';
import { ApiService } from '../services/api';
import { BusinessSettings } from '../types';
import toast from 'react-hot-toast';

export const useBusinessSettings = () => {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await ApiService.get<BusinessSettings>('business_settings');

      if (response.error) throw new Error(response.error);

      // Get first item from array or the data itself
      let settingsData = Array.isArray(response.data) ? response.data[0] : response.data;
      
      // Enforce KES as system default if nothing is set or if it's the old USD default
      if (settingsData && (!settingsData.default_currency || settingsData.default_currency === 'USD')) {
        settingsData.default_currency = 'KES';
      }
      
      setSettings(settingsData);
    } catch (error: any) {
      console.error('Error fetching business settings:', error);
      toast.error('Failed to load business settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<BusinessSettings>) => {
    try {
      let response;
      if (settings?.id) {
        response = await ApiService.update<BusinessSettings>(
          'business_settings',
          settings.id,
          updates
        );
      } else {
        response = await ApiService.create<BusinessSettings>(
          'business_settings',
          updates
        );
      }

      if (response.error) throw new Error(response.error);

      let settingsData = Array.isArray(response.data) ? response.data[0] : response.data;
      
      // Enforce KES default
      if (settingsData && (!settingsData.default_currency || settingsData.default_currency === 'USD')) {
        settingsData.default_currency = 'KES';
      }

      setSettings(settingsData);
      toast.success('Settings updated successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Error updating business settings:', error);
      toast.error('Failed to update settings');
      return { success: false, error: error.message };
    }
  };

  const uploadLogo = async (file: File) => {
    try {
      const response = await ApiService.uploadFile('image', file);

      if (response.error) throw new Error(response.error);

      const logoUrl = response.data;
      await updateSettings({ logo_url: logoUrl });

      return { success: true, url: logoUrl };
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
      return { success: false, error: error.message };
    }
  };

  const uploadFavicon = async (file: File) => {
    try {
      const response = await ApiService.uploadFile('image', file);

      if (response.error) throw new Error(response.error);

      const faviconUrl = response.data;
      await updateSettings({ favicon_url: faviconUrl });

      return { success: true, url: faviconUrl };
    } catch (error: any) {
      console.error('Error uploading favicon:', error);
      toast.error('Failed to upload favicon');
      return { success: false, error: error.message };
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    uploadLogo,
    uploadFavicon,
    refetch: fetchSettings,
  };
};