import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ProductService } from '../services/productService';
import type { Product, ProductFilters } from '../types';

interface UseInventoryReturn {
  products: Product[];
  loading: boolean;
  searchTerm: string;
  showLowStock: boolean;
  selectedProduct: Product | null;
  showModal: boolean;
  showCategoryModal: boolean;
  setSearchTerm: (term: string) => void;
  setShowLowStock: (show: boolean) => void;
  setSelectedProduct: (product: Product | null) => void;
  setShowModal: (show: boolean) => void;
  setShowCategoryModal: (show: boolean) => void;
  loadProducts: () => Promise<void>;
  handleSearch: () => void;
  handleDelete: (productId: string) => Promise<void>;
  handleSubmit: (productData: any) => Promise<boolean>;
  openEditModal: (product: Product) => void;
  openAddModal: () => void;
  resetForm: () => void;
}

export const useInventory = (): UseInventoryReturn => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const filters: ProductFilters = {
        is_active: true
      };
      
      if (searchTerm) {
        filters.search = searchTerm;
      }
      
      const products = await ProductService.getProducts(filters);
      let filteredProducts = products;
      
      if (showLowStock) {
        filteredProducts = filteredProducts.filter(product => product.current_stock <= 10);
      }
      
      setProducts(filteredProducts);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadProducts();
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      const success = await ProductService.deleteProduct(productId);
      if (success) {
        toast.success('Product deleted successfully');
        loadProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const handleSubmit = async (productData: any): Promise<boolean> => {
    try {
      let success = false;
      if (selectedProduct) {
        const updated = await ProductService.updateProduct(selectedProduct.id, productData);
        success = !!updated;
      } else {
        const created = await ProductService.createProduct(productData);
        success = !!created;
      }

      if (success) {
        toast.success(selectedProduct ? 'Product updated successfully' : 'Product added successfully');
        setShowModal(false);
        resetForm();
        loadProducts();
        return true;
      } else {
        toast.error(selectedProduct ? 'Failed to update product' : 'Failed to add product');
        return false;
      }
    } catch (error) {
      toast.error('An error occurred');
      return false;
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  return {
    products,
    loading,
    searchTerm,
    showLowStock,
    selectedProduct,
    showModal,
    showCategoryModal,
    setSearchTerm,
    setShowLowStock,
    setSelectedProduct,
    setShowModal,
    setShowCategoryModal,
    loadProducts,
    handleSearch,
    handleDelete,
    handleSubmit,
    openEditModal,
    openAddModal,
    resetForm
  };
}; 