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

  const readFileAsDataUrl = (file: File, maxDimension = 500): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = reader.result as string;
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL(file.type || 'image/png', 0.92));
          } else {
            resolve(resultStr);
          }
        };
        img.onerror = () => resolve(resultStr);
        img.src = resultStr;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadLogo = async (file: File) => {
    try {
      // 1. Convert to high-resolution optimized Data URL for instant rendering & print reliability
      const dataUrl = await readFileAsDataUrl(file, 500);

      // 2. Persist to database
      await updateSettings({ logo_url: dataUrl });

      // 3. Background upload to server /uploads if available
      try {
        await ApiService.uploadFile('image', file);
      } catch (e) {
        // Secondary upload fail is non-fatal
      }

      return { success: true, url: dataUrl };
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
      return { success: false, error: error.message };
    }
  };

  const uploadFavicon = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file, 128);
      await updateSettings({ favicon_url: dataUrl });

      try {
        await ApiService.uploadFile('image', file);
      } catch (e) {
        // Secondary upload fail is non-fatal
      }

      return { success: true, url: dataUrl };
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