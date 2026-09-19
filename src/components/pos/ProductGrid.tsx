import React from 'react';
import { Package, Gift, AlertCircle, Check, Plus, Minus } from 'lucide-react';
import type { Product } from '../../types';
import type { CartItem } from '../../hooks/useCart';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onAddToCart: (product: Product) => void;
  isDistribution?: boolean;
  cart?: CartItem[];
  onUpdateQuantity?: (productId: string, quantity: number) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ 
  products, 
  loading, 
  onAddToCart, 
  isDistribution = false,
  cart = [],
  onUpdateQuantity
}) => {
  const { settings } = useSettingsContext();
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') 
    ? settings.default_currency 
    : 'KES';

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-slate-700" />
          <h3 className="font-bold text-gray-700 dark:text-slate-300 text-sm">No items found</h3>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your search query</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => {
            const isItemInKind = product.is_in_kind || isDistribution;
            const currentStock = Number(product.current_stock ?? 0);
            const isOutOfStock = currentStock <= 0;
            const uom = product.unit_of_measure || 'units';

            // Check if product is already in active cart/voucher
            const cartItem = cart.find((i) => i.product.id === product.id);

            // For in-kind items, valuation is stored in cost_price; for retail items, in selling_price
            const effectivePrice = Number(
              isItemInKind 
                ? (product.cost_price || product.selling_price || 0) 
                : (product.selling_price || product.cost_price || 0)
            );

            return (
              <div
                key={product.id}
                onClick={() => onAddToCart(product)}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 transition-all duration-200 relative group flex flex-col justify-between ${
                  isOutOfStock
                    ? 'border-gray-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                    : cartItem
                    ? isItemInKind
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-500/10 cursor-pointer'
                      : 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10 cursor-pointer'
                    : isItemInKind
                    ? 'border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 cursor-pointer'
                    : 'border-gray-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer'
                }`}
              >
                {/* Out of stock badge */}
                {isOutOfStock && (
                  <div className="absolute top-3 right-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Out of Stock</span>
                  </div>
                )}

                {/* In Cart/Voucher badge */}
                {cartItem && !isOutOfStock && (
                  <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs z-10 ${
                    isItemInKind 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-indigo-600 text-white'
                  }`}>
                    <Check className="w-3 h-3" />
                    <span>{cartItem.quantity} {uom} {isItemInKind ? 'Distributing' : 'In Cart'}</span>
                  </div>
                )}

                <div className="text-center pt-2">
                  <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-transform group-hover:scale-105 ${
                    isItemInKind 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {isItemInKind ? <Gift className="h-7 w-7" /> : <Package className="h-7 w-7" />}
                  </div>

                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 truncate group-hover:text-emerald-600 transition-colors" title={product.name}>
                    {product.name}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono mb-2">{product.code}</p>

                  {/* Valuation / Price Display */}
                  <div className="my-2">
                    <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider block">
                      {isItemInKind ? 'Valuation / Unit' : 'Price'}
                    </span>
                    <p className={`text-base font-black font-mono ${
                      isItemInKind ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {currency} {effectivePrice.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Stock & Quick Adjuster Footer */}
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-gray-400">
                    Avail: <strong className={currentStock <= 5 ? 'text-amber-600' : 'text-gray-700 dark:text-slate-300'}>{currentStock} {uom}</strong>
                  </span>
                  
                  {cartItem && onUpdateQuantity && !isOutOfStock ? (
                    <div 
                      className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(product.id, cartItem.quantity - 1)}
                        className="w-5 h-5 rounded bg-white dark:bg-slate-700 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-200 text-xs font-black shadow-xs cursor-pointer"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black px-1 min-w-[18px] text-center text-emerald-600 dark:text-emerald-400">
                        {cartItem.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={currentStock > 0 && cartItem.quantity >= currentStock}
                        onClick={() => onUpdateQuantity(product.id, cartItem.quantity + 1)}
                        className="w-5 h-5 rounded bg-white dark:bg-slate-700 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-200 disabled:opacity-30 text-xs font-black shadow-xs cursor-pointer"
                        title="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider group-hover:underline">
                      + Add
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductGrid;