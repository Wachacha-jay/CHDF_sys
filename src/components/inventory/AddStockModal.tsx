import React, { useEffect, useState } from 'react';
import { ApiService } from '../../services/api';
import { ProductService } from '../../services/productService';
import { SupplierService } from '../../services/supplierService';
import type { Product, Supplier } from '../../types';
import { toast } from 'react-hot-toast';
import { Truck, Info } from 'lucide-react';

interface AddStockModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddStockModal: React.FC<AddStockModalProps> = ({ open, onClose, onSuccess }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      ApiService.get<Product>('products', { filters: { is_active: 1 } }).then(res => {
        if (res.success && res.data) setProducts(res.data);
      });
      ApiService.get<Supplier>('suppliers', { filters: { is_active: 1 } }).then(res => {
        if (res.success && res.data) setSuppliers(res.data);
      });
      setSelectedSupplier('');
      setSelectedProduct('');
      setQuantity('');
      setUnitCost('');
      setNotes('');
    }
  }, [open]);

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    const product = products.find(p => p.id === productId);
    if (product) setUnitCost(String(product.cost_price || ''));
    else setUnitCost('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !quantity) {
      toast.error('Please select a product and enter quantity');
      return;
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Quantity must be a positive number');
      return;
    }
    setLoading(true);
    try {
      if (selectedSupplier) {
        // Path A: Supplier Purchase Invoice (Official supplier invoice with AP & ledger impact)
        const purchaseData = {
          supplier_id: selectedSupplier,
          purchase_date: new Date().toISOString().split('T')[0],
          notes: notes || 'Stock addition from Inventory Module',
          items: [{
            product_id: selectedProduct,
            quantity: qty,
            unit_cost: Number(unitCost) || (products.find(p => p.id === selectedProduct)?.cost_price || 0)
          }]
        };
        const purchase = await SupplierService.createPurchase(purchaseData);
        if (purchase) {
          toast.success(`Stock added & Purchase invoice ${purchase.purchase_number || ''} recorded!`);
          onSuccess();
        } else {
          toast.error('Failed to create purchase for supplier. Please try again.');
        }
      } else {
        // Path B: Direct Stock Addition (Internal count/adjustment without supplier invoice)
        const stockUpdated = await ProductService.updateStock(selectedProduct, qty, 'in');
        if (stockUpdated) {
          if (notes) {
            try {
              await ApiService.create('inventory_movements', {
                product_id: selectedProduct,
                movement_type: 'in',
                quantity: qty,
                unit_cost: Number(unitCost) || 0,
                reference_type: 'manual_adjustment',
                description: notes
              });
            } catch (_) {}
          }
          toast.success('Stock added successfully (Direct Adjustment)');
          onSuccess();
        } else {
          toast.error('Failed to add stock. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('Add stock error:', err);
      toast.error(err?.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const selectedProductData = products.find(p => p.id === selectedProduct);
  const selectedSupplierData = suppliers.find(s => s.id === selectedSupplier);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Add Stock</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium text-gray-700">
              Supplier <span className="text-xs text-gray-500 font-normal">(Optional)</span>
            </label>
            <select
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Direct Stock Addition (No Supplier) --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.code ? `(${s.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedSupplier ? (
            <div className="flex items-start gap-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800">
              <Truck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Adding via <strong>{selectedSupplierData?.name}</strong>: An official purchase invoice and Accounts Payable entry will be generated.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
              <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <span>
                Direct adjustment: Updates inventory levels directly without creating a supplier payable invoice.
              </span>
            </div>
          )}

          <div>
            <label className="block mb-1 font-medium text-gray-700">Product *</label>
            <select
              value={selectedProduct}
              onChange={e => handleProductChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.code ? ` (${p.code})` : ''} — Stock: {p.current_stock}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium text-gray-700">Quantity to Add *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-700">Unit Cost (KES)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={e => setUnitCost(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Optional"
              />
            </div>
          </div>

          {selectedProductData && quantity && Number(quantity) > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <strong>After addition:</strong> Stock will be{' '}
              <strong>{(Number(selectedProductData.current_stock) + Number(quantity)).toFixed(2)}</strong>{' '}
              {selectedProductData.unit_of_measure}
            </div>
          )}

          <div>
            <label className="block mb-1 font-medium text-gray-700">Notes / Reference</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Delivery note #, PO #123, Initial count..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              Cancel
            </button>
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Adding...' : selectedSupplier ? 'Add Stock & Create Invoice' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStockModal;