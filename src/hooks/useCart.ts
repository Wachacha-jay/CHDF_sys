import { useState } from 'react';
import type { Product } from '../types';
import toast from 'react-hot-toast';

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Product, mode: 'retail' | 'distribution' = 'retail') => {
    const isDist = mode === 'distribution' || !!product.is_in_kind;
    const currentStock = Number(product.current_stock ?? 0);

    // Hard stock boundary check: prevent adding out-of-stock items
    if (currentStock <= 0) {
      toast.error(`"${product.name}" is out of stock (0 ${product.unit_of_measure || 'units'} available)`);
      return;
    }

    // In-kind distribution prioritizes cost_price (Fair Market Value); retail prioritizes selling_price
    const effectiveUnitPrice = Number(
      isDist 
        ? (product.cost_price || product.selling_price || 0) 
        : (product.selling_price || product.cost_price || 0)
    );

    const existingItem = cart.find(item => item.product.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= currentStock) {
        toast.error(`Cannot add more "${product.name}". Maximum available stock is ${currentStock} ${product.unit_of_measure || 'units'}.`);
        return;
      }
      const nextQty = Math.min(currentStock, existingItem.quantity + 1);
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
        const maxStock = Number(item.product.current_stock ?? 0);
        if (maxStock > 0 && quantity > maxStock) {
          toast.error(`Quantity capped at available stock (${maxStock} ${item.product.unit_of_measure || 'units'})`);
          return { ...item, quantity: maxStock };
        }
        return { ...item, quantity };
      }
      return item;
    }));
  };

  const updateUnitPrice = (productId: string, unitPrice: number) => {
    setCart(cart.map(item =>
      item.product.id === productId 
        ? { ...item, unitPrice: Math.max(0, unitPrice) } 
        : item
    ));
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
    updateUnitPrice,
    removeFromCart,
    getTotal,
    clearCart
  };
};