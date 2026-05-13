import React from 'react';
import { Package } from 'lucide-react';
import type { Product } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  onAddToCart: (product: Product) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, loading, onAddToCart }) => {
  const { settings } = useSettingsContext();

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => onAddToCart(product)}
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="font-medium text-gray-900 text-sm mb-1">{product.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{product.code}</p>
                <p className="text-lg font-bold text-blue-600">
                  {settings?.default_currency || 'USD'} {product.selling_price.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Stock: {product.current_stock}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductGrid; 