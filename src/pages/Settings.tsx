import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Save, Upload, Building2, Globe, Mail, Phone, MapPin, 
  DollarSign, Hash, Scale, UserCheck, CreditCard 
} from 'lucide-react';
import { useBusinessSettings } from '../hooks/useBusinessSettings';
import { BusinessSettings } from '../types';
import toast from 'react-hot-toast';
import UnitsSettings from '../components/settings/UnitsSettings';
import DesignationsSettings from '../components/settings/DesignationsSettings';

type TabType = 'general' | 'financial' | 'prefixes' | 'units' | 'designations' | 'mpesa';

const Settings: React.FC = () => {
  const { settings, loading, updateSettings, uploadLogo, uploadFavicon } = useBusinessSettings();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [uploading, setUploading] = useState(false);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<BusinessSettings>({
    defaultValues: settings || undefined,
    values: settings || undefined,
  });

  const onSubmit = async (data: BusinessSettings) => {
    const result = await updateSettings(data);
    if (!result.success) {
      toast.error('Failed to update settings');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    const result = await uploadLogo(file);
    if (result.success) toast.success('Logo uploaded successfully');
    setUploading(false);
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setUploading(true);
    const result = await uploadFavicon(file);
    if (result.success) toast.success('Favicon uploaded successfully');
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'prefixes', label: 'ID Prefixes', icon: Hash },
    { id: 'units', label: 'Units', icon: Scale },
    { id: 'designations', label: 'Designations', icon: UserCheck },
    { id: 'mpesa', label: 'M-Pesa', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Configure your business identity and application-wide preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tab Sidebar */}
        <div className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 translate-x-1'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <tab.icon className={`w-5 h-5 mr-3 ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[500px]">
          <div className="p-6 h-full">
            {['general', 'financial', 'prefixes', 'mpesa'].includes(activeTab) ? (
              <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
                <div className="flex-1">
                  {activeTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <section>
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Business Identity</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Business Name</label>
                            <input
                              type="text"
                              {...register('business_name', { required: 'Business name is required' })}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Enter business name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                            <input type="email" {...register('business_email')} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="business@example.com" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                            <input type="tel" {...register('business_phone')} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+1 (555) 123-4567" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                            <textarea {...register('business_address')} rows={2} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter complete business address" />
                          </div>
                        </div>
                      </section>

                      <section>
                        <h2 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Branding</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                              {settings?.logo_url ? <img src={settings.logo_url} className="w-full h-full object-contain" /> : <Upload className="w-6 h-6 text-gray-300" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">Main Logo</p>
                              <label className="mt-1 cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 block">
                                {uploading ? 'Uploading...' : 'Click to change logo'}
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                              </label>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                              {settings?.favicon_url ? <img src={settings.favicon_url} className="w-full h-full object-contain" /> : <Upload className="w-4 h-4 text-gray-300" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">Browser Favicon</p>
                              <label className="mt-1 cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-700 block">
                                Change favicon
                                <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
                              </label>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}

                  {activeTab === 'financial' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Currency & Tax</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Default Currency</label>
                          <select {...register('default_currency')} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="KES">KES - Kenyan Shilling</option>
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="NGN">NGN - Nigerian Naira</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Tax Rate (%)</label>
                          <input type="number" step="0.01" {...register('tax_rate', { valueAsNumber: true })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Fiscal Year Start</label>
                          <select {...register('fiscal_year_start', { valueAsNumber: true })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                            {Array.from({ length: 12 }, (_, i) => (
                              <option key={i + 1} value={i + 1}>{new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'prefixes' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Document Numbering</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {['receipt_prefix', 'invoice_prefix', 'product_code_prefix', 'customer_code_prefix', 'supplier_code_prefix', 'employee_code_prefix'].map(field => (
                          <div key={field}>
                            <label className="block text-sm font-semibold text-gray-700 capitalize mb-1">{field.replace(/_/g, ' ')}</label>
                            <input type="text" {...register(field as any)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'mpesa' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">M-Pesa Integration</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Consumer Key</label>
                          <input type="text" {...register('mpesa_consumer_key')} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Consumer Secret</label>
                          <input type="password" {...register('mpesa_consumer_secret')} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Shortcode</label>
                          <input type="text" {...register('mpesa_shortcode')} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Passkey</label>
                          <input type="text" {...register('mpesa_passkey')} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={!isDirty}
                    className="bg-blue-600 text-white px-8 py-2.5 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all font-bold disabled:opacity-50 flex items-center shadow-lg shadow-blue-200"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="h-full">
                {activeTab === 'units' && <UnitsSettings />}
                {activeTab === 'designations' && <DesignationsSettings />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;