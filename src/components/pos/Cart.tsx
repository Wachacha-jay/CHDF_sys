import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Package, Gift } from 'lucide-react';
import type { CartItem } from '../../hooks/useCart';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface CartProps {
  cart: CartItem[];
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  isDistribution?: boolean;
}

const Cart: React.FC<CartProps> = ({ cart, updateQuantity, removeFromCart, isDistribution = false }) => {
  const { settings } = useSettingsContext();
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') 
    ? settings.default_currency 
    : 'KES';

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
      {cart.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="font-semibold">{isDistribution ? 'Distribution list is empty' : 'Cart is empty'}</p>
          <p className="text-xs text-gray-400 mt-1">
            {isDistribution 
              ? 'Select in-kind donation items from the catalog' 
              : 'Add commercial products to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cart.map((item) => {
            const isItemInKind = item.product.is_in_kind || isDistribution;
            const currentStock = Number(item.product.current_stock ?? 0);
            const unitPrice = Number(
              item.unitPrice !== undefined && item.unitPrice > 0 
                ? item.unitPrice 
                : (item.product.cost_price || item.product.selling_price || 0)
            );
            const lineTotal = Number(item.quantity || 1) * unitPrice;
            const uom = item.product.unit_of_measure || 'units';

            return (
              <div 
                key={item.product.id} 
                className={`bg-white dark:bg-slate-900 rounded-xl p-3.5 border transition-all ${
                  isItemInKind 
                    ? 'border-emerald-200 dark:border-emerald-900/60 shadow-xs' 
                    : 'border-gray-200 dark:border-slate-800'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      {isItemInKind ? (
                        <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Package className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      )}
                      <h3 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm leading-tight">
                        {item.product.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400 font-mono">{item.product.code}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                        currentStock > 0 
                          ? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        Avail: {currentStock} {uom}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                  {/* Quantity controls with editable input */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-40"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    
                    <input
                      type="number"
                      min="1"
                      max={currentStock > 0 ? currentStock : undefined}
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          updateQuantity(item.product.id, val);
                        }
                      }}
                      className="w-14 text-center text-xs font-bold py-1 px-1 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                    />

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      disabled={currentStock > 0 && item.quantity >= currentStock}
                      className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-40"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Valuation / Price breakdown */}
                  <div className="text-right">
                    <p className={`text-xs sm:text-sm font-black font-mono ${
                      isItemInKind ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {currency} {lineTotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {currency} {unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {uom}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cart;