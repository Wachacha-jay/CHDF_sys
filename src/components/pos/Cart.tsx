import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import type { CartItem } from '../../hooks/useCart';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface CartProps {
  cart: CartItem[];
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
}

const Cart: React.FC<CartProps> = ({ cart, updateQuantity, removeFromCart }) => {
  const { settings } = useSettingsContext();

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {cart.length === 0 ? (
        <div className="text-center text-gray-500 mt-8">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Cart is empty</p>
          <p className="text-sm">Add products to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.product.id} className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 text-sm">{item.product.name}</h3>
                  <p className="text-xs text-gray-500">{item.product.code}</p>
                </div>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {settings?.default_currency && settings.default_currency !== 'USD' ? settings.default_currency : 'KES'} {(item.quantity * item.unitPrice).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {settings?.default_currency && settings.default_currency !== 'USD' ? settings.default_currency : 'KES'} {item.unitPrice.toFixed(2)} each
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Cart; 