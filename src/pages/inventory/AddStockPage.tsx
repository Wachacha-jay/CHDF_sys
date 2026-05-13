import React, { useEffect, useState } from 'react';
import { SupplierService } from '../../services/supplierService';
import { ApiService } from '../../services/api';
import type { Supplier, Product } from '../../types';
import { toast } from 'react-hot-toast';

const AddStockPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ApiService.get<Supplier>('suppliers', { filters: { is_active: true } }).then(res => {
      if (res.success && res.data) setSuppliers(res.data);
    });
    ApiService.get<Product>('products', { filters: { is_active: true } }).then(res => {
      if (res.success && res.data) setProducts(res.data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedProduct || !quantity) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    const purchaseData = {
      supplier_id: selectedSupplier,
      purchase_date: new Date().toISOString().split('T')[0],
      items: [{ product_id: selectedProduct, quantity: Number(quantity), unit_cost: products.find(p => p.id === selectedProduct)?.cost_price || 0 }],
    };
    const result = await SupplierService.createPurchase(purchaseData);
    setLoading(false);
    if (result) {
      toast.success('Stock added successfully');
      setSelectedSupplier('');
      setSelectedProduct('');
      setQuantity('');
    } else {
      toast.error('Failed to add stock');
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Stock</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Supplier</label>
          <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full border rounded px-3 py-2" required>
            <option value="">Select supplier</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Product</label>
          <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-full border rounded px-3 py-2" required>
            <option value="">Select product</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Quantity</label>
          <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>{loading ? 'Adding...' : 'Add Stock'}</button>
      </form>
    </div>
  );
};

export default AddStockPage; 