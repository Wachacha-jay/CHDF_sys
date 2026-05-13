export interface StockStatus {
  color: string;
  bg: string;
  text: string;
}

export const getStockStatus = (stock: number): StockStatus => {
  if (stock === 0) {
    return { color: 'text-red-600', bg: 'bg-red-50', text: 'Out of Stock' };
  } else if (stock <= 10) {
    return { color: 'text-orange-600', bg: 'bg-orange-50', text: 'Low Stock' };
  } else {
    return { color: 'text-green-600', bg: 'bg-green-50', text: 'In Stock' };
  }
};

export const isLowStock = (currentStock: number, minimumStock: number = 10): boolean => {
  return currentStock <= minimumStock;
};

export const isOutOfStock = (currentStock: number): boolean => {
  return currentStock === 0;
};

export const getStockPercentage = (currentStock: number, minimumStock: number): number => {
  if (minimumStock === 0) return 100;
  return Math.min((currentStock / minimumStock) * 100, 100);
}; 