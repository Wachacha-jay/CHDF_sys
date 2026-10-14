import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit, Trash2, Package, AlertTriangle, FolderOpen, 
  ShoppingBag, Gift, Briefcase, Layers, Sparkles, CheckCircle2 
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { getStockStatus } from '../utils/stockUtils';
import ProductForm from '../components/inventory/ProductForm';
import CategoryManagementModal from '../components/inventory/CategoryManagementModal';
import AddStockModal from '../components/inventory/AddStockModal';
import { useLocation } from 'react-router-dom';
import { useSettingsContext } from '../contexts/SettingsContext';

type InventoryTab = 'commercial' | 'in_kind' | 'services' | 'all';

const Inventory: React.FC = () => {
  const location = useLocation();
  const { settings } = useSettingsContext();
  const [showAddStock, setShowAddStock] = useState(false);
  const [activeTab, setActiveTab] = useState<InventoryTab>('commercial');

  const {
    products,
    loading,
    searchTerm,
    showLowStock,
    selectedProduct,
    showModal,
    showCategoryModal,
    modalDefaultType,
    setSearchTerm,
    setShowLowStock,
    setShowModal,
    setShowCategoryModal,
    loadProducts,
    handleSearch,
    handleDelete,
    handleSubmit,
    openEditModal,
    openAddModal
  } = useInventory();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('lowStock') === '1') {
      setShowLowStock(true);
      setActiveTab('commercial');
    }
    const tabParam = params.get('tab');
    if (tabParam === 'in_kind' || tabParam === 'services' || tabParam === 'commercial' || tabParam === 'all') {
      setActiveTab(tabParam as InventoryTab);
    }
  }, [location.search, setShowLowStock]);

  const currency = settings?.default_currency && settings.default_currency !== 'USD' 
    ? settings.default_currency 
    : 'KES';

  // Counts across the 3 categories
  const commercialCount = useMemo(() => products.filter(p => !p.is_in_kind && !p.is_service).length, [products]);
  const inKindCount = useMemo(() => products.filter(p => !!p.is_in_kind).length, [products]);
  const servicesCount = useMemo(() => products.filter(p => !!p.is_service).length, [products]);
  const allCount = products.length;

  // Filter products by active tab
  const displayedProducts = useMemo(() => {
    switch (activeTab) {
      case 'commercial':
        return products.filter(p => !p.is_in_kind && !p.is_service);
      case 'in_kind':
        return products.filter(p => !!p.is_in_kind);
      case 'services':
        return products.filter(p => !!p.is_service);
      case 'all':
      default:
        return products;
    }
  }, [products, activeTab]);

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Inventory & Catalog Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage commercial stock, charitable in-kind donations, and billable services catalog
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="bg-white border border-gray-300 text-gray-700 px-3.5 py-2 rounded-lg hover:bg-gray-50 flex items-center text-sm font-medium shadow-sm transition-colors"
          >
            <FolderOpen className="h-4 w-4 mr-2 text-gray-500" />
            Manage Categories
          </button>

          {activeTab !== 'services' && (
            <button
              onClick={() => setShowAddStock(true)}
              className="bg-emerald-600 text-white px-3.5 py-2 rounded-lg hover:bg-emerald-700 flex items-center text-sm font-semibold shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Stock
            </button>
          )}

          <button
            onClick={() => openAddModal(activeTab === 'all' ? 'commercial' : activeTab)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {activeTab === 'services' 
              ? 'Add Service' 
              : activeTab === 'in_kind' 
              ? 'Add In-Kind Product' 
              : activeTab === 'commercial' 
              ? 'Add Commercial Product' 
              : 'Add Product'}
          </button>
        </div>
      </div>

      <AddStockModal
        open={showAddStock}
        onClose={() => setShowAddStock(false)}
        onSuccess={() => {
          setShowAddStock(false);
          loadProducts();
        }}
      />

      {/* Tabs Navigation */}
      <div className="flex flex-wrap border-b border-gray-200 bg-white rounded-t-xl px-2 pt-2 shadow-sm">
        <button
          onClick={() => setActiveTab('commercial')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-all mr-2 ${
            activeTab === 'commercial'
              ? 'border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <ShoppingBag className="h-4 w-4 mr-2 text-blue-600" />
          <span>Products - Commercial</span>
          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${
            activeTab === 'commercial' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {commercialCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('in_kind')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-all mr-2 ${
            activeTab === 'in_kind'
              ? 'border-amber-600 text-amber-800 bg-amber-50/60 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Gift className="h-4 w-4 mr-2 text-amber-600" />
          <span>Products - In-Kind</span>
          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${
            activeTab === 'in_kind' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600'
          }`}>
            {inKindCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-all mr-2 ${
            activeTab === 'services'
              ? 'border-indigo-600 text-indigo-800 bg-indigo-50/60 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Briefcase className="h-4 w-4 mr-2 text-indigo-600" />
          <span>Services</span>
          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${
            activeTab === 'services' ? 'bg-indigo-100 text-indigo-900' : 'bg-gray-100 text-gray-600'
          }`}>
            {servicesCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'all'
              ? 'border-slate-800 text-slate-900 bg-slate-100/70 rounded-t-lg'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }`}
        >
          <Layers className="h-4 w-4 mr-2 text-slate-600" />
          <span>All Catalog Items</span>
          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${
            activeTab === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {allCount}
          </span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-64 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder={
                  activeTab === 'services' 
                    ? "Search services by name or code..." 
                    : activeTab === 'in_kind' 
                    ? "Search in-kind items..." 
                    : "Search products..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {activeTab !== 'services' ? (
              <label className="flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showLowStock}
                  onChange={(e) => setShowLowStock(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Show low stock only</span>
              </label>
            ) : (
              <div className="flex items-center text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                <span>Services have no inventory stock count. Stock alerts are disabled.</span>
              </div>
            )}
            
            <button
              onClick={handleSearch}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-[850px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {activeTab === 'services' ? (
                  /* Services Table Header */
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Service Name & Details
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Billing Unit
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Direct Cost
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Service Fee / Rate
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Classification
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                ) : (
                  /* Commercial / In-Kind / All Table Header */
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      {activeTab === 'in_kind' ? 'In-Kind Item' : 'Product'}
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Current Stock
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      {activeTab === 'in_kind' ? 'Fair Market Value / Cost' : 'Cost Price'}
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Selling Price
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                )}
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {displayedProducts.map((product) => {
                  const stockStatus = getStockStatus(product.current_stock, product.is_service);

                  if (activeTab === 'services') {
                    /* Services Row */
                    return (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-9 h-9 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {product.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  Service
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 max-w-xs truncate">
                                {product.description || 'No description provided'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                          {product.code}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium text-gray-800">{product.category?.name || 'Services'}</div>
                            {product.subcategory && (
                              <div className="text-xs text-gray-500">{product.subcategory.name}</div>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <span className="capitalize font-medium">{product.unit_of_measure || 'Unit'}</span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {currency} {Number(product.cost_price || 0).toFixed(2)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {currency} {Number(product.selling_price || 0).toFixed(2)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-blue-600" />
                            Active Service
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(product)}
                              className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                              title="Edit Service"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                              title="Delete Service"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  /* Commercial, In-Kind, and All Items Row */
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 ${
                            product.is_service
                              ? 'bg-indigo-100 text-indigo-700'
                              : product.is_in_kind
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {product.is_service ? (
                              <Briefcase className="h-4 w-4" />
                            ) : product.is_in_kind ? (
                              <Gift className="h-4 w-4" />
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">
                                {product.name}
                              </span>
                              {product.is_in_kind && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  In-Kind
                                </span>
                              )}
                              {product.is_service && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  Service
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 max-w-xs truncate">
                              {product.description || 'No description'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                        {product.code}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{product.category?.name || 'Uncategorized'}</div>
                          {product.subcategory && (
                            <div className="text-xs text-gray-500">{product.subcategory.name}</div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {product.is_service ? (
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            Service (No stock)
                          </span>
                        ) : (
                          <div className="flex items-center">
                            <span className="text-sm font-bold text-gray-900">
                              {product.current_stock}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">
                              {product.unit_of_measure || 'units'}
                            </span>
                            {product.current_stock <= (product.minimum_stock || 10) && (
                              <AlertTriangle className="h-4 w-4 text-orange-500 ml-2" />
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {currency} {Number(product.cost_price || 0).toFixed(2)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {currency} {Number(product.selling_price || 0).toFixed(2)}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.bg} ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {!loading && displayedProducts.length === 0 && (
          <div className="text-center py-16 px-4">
            {activeTab === 'services' ? (
              <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            ) : activeTab === 'in_kind' ? (
              <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            ) : (
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            )}
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              {activeTab === 'services'
                ? 'No services found'
                : activeTab === 'in_kind'
                ? 'No in-kind products found'
                : 'No commercial products found'}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {activeTab === 'services'
                ? 'Add billable services, consulting fees, or non-inventory offerings.'
                : activeTab === 'in_kind'
                ? 'Add consumable donation items designated for distributions.'
                : 'Get started by adding your first commercial product.'}
            </p>
            <button
              onClick={() => openAddModal(activeTab === 'all' ? 'commercial' : activeTab)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {activeTab === 'services' 
                ? 'Add First Service' 
                : activeTab === 'in_kind' 
                ? 'Add First In-Kind Item' 
                : 'Add First Product'}
            </button>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductForm
          product={selectedProduct}
          defaultType={
            selectedProduct
              ? (selectedProduct.is_service ? 'services' : selectedProduct.is_in_kind ? 'in_kind' : 'commercial')
              : (activeTab === 'all' ? modalDefaultType : activeTab)
          }
          onSubmit={handleSubmit}
          onCancel={() => setShowModal(false)}
        />
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <CategoryManagementModal
          onClose={() => setShowCategoryModal(false)}
          onCategoryUpdate={() => {
            loadProducts();
            setShowCategoryModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Inventory;