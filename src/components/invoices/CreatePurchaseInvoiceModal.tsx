import React, { useEffect, useState } from 'react';
import { SupplierService } from '../../services/supplierService';
import { ApiService } from '../../services/api';
import type { Supplier, Product } from '../../types';
import { toast } from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

interface CreatePurchaseInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePurchaseInvoiceModal: React.FC<CreatePurchaseInvoiceModalProps> = ({ open, onClose, onSuccess }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [items, setItems] = useState([{ product_id: '', quantity: 1, unit_cost: 0 }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      ApiService.get<Supplier>('suppliers', { filters: { is_active: true } }).then(res => {
        if (res.success && res.data) setSuppliers(res.data);
      });
      ApiService.get<Product>('products', { filters: { is_active: true } }).then(res => {
        if (res.success && res.data) setProducts(res.data);
      });
    }
  }, [open]);

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    const newItems = [...items];
    newItems[index].product_id = productId;
    if (product) {
      newItems[index].unit_cost = product.cost_price || 0;
    }
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: 'quantity' | 'unit_cost', value: number) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_cost: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) {
      toast.error('Please select a supplier or service provider');
      return;
    }
    if (items.some(i => !i.product_id || i.quantity <= 0 || i.unit_cost < 0)) {
      toast.error('Please complete all item fields with valid amounts');
      return;
    }
    
    setLoading(true);
    const purchaseData = {
      supplier_id: selectedSupplier,
      purchase_date: purchaseDate,
      notes: notes,
      items: items.map(item => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost)
      })),
    };
    
    const result = await SupplierService.createPurchase(purchaseData);
    setLoading(false);
    
    if (result) {
      toast.success('Purchase invoice created successfully');
      setSelectedSupplier('');
      setNotes('');
      setItems([{ product_id: '', quantity: 1, unit_cost: 0 }]);
      onSuccess();
    } else {
      toast.error('Failed to create invoice');
    }
  };

  if (!open) return null;

  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  const taxAmount = totalAmount * 0.16; // Assuming 16% generic tax like in the service

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Create Purchase Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Supplier / Service Provider</label>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full border rounded-lg px-3 py-2" required>
                <option value="">-- Select --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} {s.organization_name ? `(${s.organization_name})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Invoice Date</label>
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Items / Services</label>
              <button type="button" onClick={addItem} className="text-sm text-blue-600 flex items-center hover:text-blue-800">
                <Plus size={16} className="mr-1" /> Add Line
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <select value={item.product_id} onChange={e => handleProductChange(index, e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required>
                      <option value="">Select product or service</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <input type="number" min="0.01" step="0.01" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div className="w-32">
                    <input type="number" min="0" step="0.01" placeholder="Unit Cost" value={item.unit_cost} onChange={e => handleItemChange(index, 'unit_cost', parseFloat(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div className="w-32 pt-2 text-right font-medium text-sm text-gray-700">
                    {(item.quantity * item.unit_cost).toLocaleString()}
                  </div>
                  <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-500 hover:text-red-700 disabled:opacity-50" disabled={items.length === 1}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t pt-4 flex justify-between items-start">
            <div className="flex-1 mr-8">
              <label className="block mb-1 text-sm font-medium text-gray-700">Notes (Optional)</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Invoice notes or reference..." />
            </div>
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal:</span> <span className="font-medium">{totalAmount.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Tax (16%):</span> <span className="font-medium">{taxAmount.toLocaleString()}</span></div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-2">
                <span>Total:</span> <span>{(totalAmount + taxAmount).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium shadow-sm" disabled={loading}>
              {loading ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePurchaseInvoiceModal;
