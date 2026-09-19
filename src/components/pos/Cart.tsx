import React, { useState, useEffect } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Package, Gift, AlertTriangle } from 'lucide-react';
import type { CartItem } from '../../hooks/useCart';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface CartProps {
  cart: CartItem[];
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice?: (productId: string, unitPrice: number) => void;
  removeFromCart: (productId: string) => void;
  isDistribution?: boolean;
}

const CartItemRow: React.FC<{
  item: CartItem;
  updateQuantity: (productId: string, quantity: number) => void;
  updateUnitPrice?: (productId: string, unitPrice: number) => void;
  removeFromCart: (productId: string) => void;
  isDistribution: boolean;
  currency: string;
}> = ({ item, updateQuantity, updateUnitPrice, removeFromCart, isDistribution, currency }) => {
  const currentStock = Number(item.product.current_stock ?? 0);
  const uom = item.product.unit_of_measure || 'units';
  const isItemInKind = item.product.is_in_kind || isDistribution;
  
  // Local input string state allows users to backspace, clear, and type numbers smoothly
  const [qtyInput, setQtyInput] = useState(String(item.quantity));
  const [isEditingValuation, setIsEditingValuation] = useState(false);

  useEffect(() => {
    setQtyInput(String(item.quantity));
  }, [item.quantity]);

  const effectiveUnitPrice = Number(
    item.unitPrice !== undefined && item.unitPrice > 0 
      ? item.unitPrice 
      : (item.product.cost_price || item.product.selling_price || 0)
  );

  const lineTotal = Number(item.quantity || 1) * effectiveUnitPrice;
  const isExceedingStock = currentStock > 0 && item.quantity > currentStock;

  const handleQtyBlur = () => {
    let parsed = parseInt(qtyInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      parsed = 1;
    } else if (currentStock > 0 && parsed > currentStock) {
      parsed = currentStock;
    }
    setQtyInput(String(parsed));
    updateQuantity(item.product.id, parsed);
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQtyInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      const capped = currentStock > 0 ? Math.min(parsed, currentStock) : parsed;
      updateQuantity(item.product.id, capped);
    }
  };

  const handleSetMax = () => {
    if (currentStock > 0) {
      setQtyInput(String(currentStock));
      updateQuantity(item.product.id, currentStock);
    }
  };

  return (
    <div 
      className={`bg-white dark:bg-slate-900 rounded-xl p-3.5 border transition-all ${
        isExceedingStock 
          ? 'border-red-400 dark:border-red-700 bg-red-50/20'
          : isItemInKind 
          ? 'border-emerald-200 dark:border-emerald-900/60 shadow-xs' 
          : 'border-gray-200 dark:border-slate-800'
      }`}
    >
      {/* Header Info */}
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
          
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 font-mono">{item.product.code}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              currentStock <= 0
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                : currentStock <= 5
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50'
            }`}>
              Avail: {currentStock} {uom}
            </span>
            {currentStock > 0 && item.quantity < currentStock && (
              <button
                type="button"
                onClick={handleSetMax}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                title="Distribute all available stock"
              >
                Distribute Max ({currentStock})
              </button>
            )}
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

      {/* Stock warning if exceeding */}
      {isExceedingStock && (
        <div className="mb-2 p-1.5 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-1.5 text-red-700 dark:text-red-300 text-[10px] font-bold">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Quantity exceeds available stock ({currentStock} max)</span>
        </div>
      )}

      {/* Quantity and Pricing Row */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-slate-800/80">
        {/* Quantity Controls */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
            disabled={item.quantity <= 1}
            className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
            title="Decrease quantity"
          >
            <Minus className="h-3 w-3" />
          </button>
          
          <input
            type="number"
            min="1"
            max={currentStock > 0 ? currentStock : undefined}
            value={qtyInput}
            onChange={handleQtyChange}
            onBlur={handleQtyBlur}
            className={`w-14 text-center text-xs font-black py-1 px-1 border rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-colors ${
              isExceedingStock ? 'border-red-500 text-red-600' : 'border-gray-200 dark:border-slate-700'
            }`}
            title="Type exact quantity to distribute"
          />

          <button
            type="button"
            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
            disabled={currentStock > 0 && item.quantity >= currentStock}
            className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
            title="Increase quantity"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Valuation Display */}
        <div className="text-right">
          <p className={`text-xs sm:text-sm font-black font-mono ${
            isItemInKind ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
          }`}>
            {currency} {lineTotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          
          <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400">
            {isEditingValuation && updateUnitPrice ? (
              <div className="flex items-center gap-1 mt-0.5">
                <span>{currency}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) => updateUnitPrice(item.product.id, Number(e.target.value))}
                  onBlur={() => setIsEditingValuation(false)}
                  autoFocus
                  className="w-16 px-1 py-0.5 text-right text-[10px] font-bold border border-emerald-300 rounded"
                />
              </div>
            ) : (
              <span 
                onClick={() => updateUnitPrice && setIsEditingValuation(true)}
                className={`cursor-pointer ${isItemInKind ? 'hover:text-emerald-600' : 'hover:text-gray-600'}`}
                title={updateUnitPrice ? "Click to customize unit valuation" : undefined}
              >
                {currency} {effectiveUnitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {uom}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Cart: React.FC<CartProps> = ({ 
  cart, 
  updateQuantity, 
  updateUnitPrice, 
  removeFromCart, 
  isDistribution = false 
}) => {
  const { settings } = useSettingsContext();
  const currency = (settings?.default_currency && settings.default_currency !== 'USD') 
    ? settings.default_currency 
    : 'KES';

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
      {cart.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="font-semibold text-sm text-gray-700 dark:text-slate-300">
            {isDistribution ? 'Distribution list is empty' : 'Cart is empty'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {isDistribution 
              ? 'Click in-kind items in the catalog to add to distribution voucher' 
              : 'Add commercial products to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cart.map((item) => (
            <CartItemRow
              key={item.product.id}
              item={item}
              updateQuantity={updateQuantity}
              updateUnitPrice={updateUnitPrice}
              removeFromCart={removeFromCart}
              isDistribution={isDistribution}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Cart;