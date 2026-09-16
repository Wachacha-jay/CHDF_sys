import { useState } from 'react';
import type { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    // For in-kind items, selling_price is usually 0; use cost_price (valuation)
    const effectiveUnitPrice = Number(
      (product.is_in_kind ? product.cost_price : product.selling_price) || 
      product.selling_price || 
      product.cost_price || 
      0
    );

    const maxStock = Number(product.current_stock ?? 999999);

    if (existingItem) {
      const nextQty = Math.min(maxStock > 0 ? maxStock : 1, existingItem.quantity + 1);
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: nextQty }
          : item
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        unitPrice: effectiveUnitPrice
      }]);
    }
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const maxStock = Number(item.product.current_stock ?? 999999);
        const cappedQty = maxStock > 0 ? Math.min(quantity, maxStock) : quantity;
        return { ...item, quantity: cappedQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getTotal = () => {
    return cart.reduce((total, item) => {
      const price = Number(
        item.unitPrice !== undefined && item.unitPrice > 0 
          ? item.unitPrice 
          : (item.product.cost_price || item.product.selling_price || 0)
      );
      return total + (item.quantity * price);
    }, 0);
  };

  const clearCart = () => {
    setCart([]);
  };

  return {
    cart,
    setCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getTotal,
    clearCart
  };
};