import { ApiService } from './api';
import { Product, Category } from '../types';

export interface ProductFilters {
  category_id?: string;
  subcategory_id?: string;
  is_active?: boolean;
  is_service?: boolean;
  search?: string;
}

export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
}

export class ProductService {
  // Product CRUD operations
  static async getProducts(filters?: ProductFilters, options?: {
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending?: boolean };
  }): Promise<Product[]> {
    const select = `*`;
    let apiFilters: Record<string, any> = {};

    if (filters?.is_active !== undefined) apiFilters.is_active = filters.is_active ? 1 : 0;
    if (filters?.is_service !== undefined) apiFilters.is_service = filters.is_service ? 1 : 0;
    if (filters?.category_id) apiFilters.category_id = filters.category_id;
    if (filters?.subcategory_id) apiFilters.subcategory_id = filters.subcategory_id;

    const response = await ApiService.get<Product>('products', {
      select,
      filters: apiFilters,
      orderBy: options?.orderBy || { column: 'name', ascending: true },
      limit: options?.limit,
      offset: options?.offset
    });

    if (response.success && response.data) {
      let products = response.data;

      // Fetch categories to map them for the UI
      try {
        const categoriesRes = await ApiService.get<Category>('categories');
        if (categoriesRes.success && categoriesRes.data) {
          const catMap = new Map(categoriesRes.data.map(c => [c.id, c]));
          products = products.map(p => ({
            ...p,
            category: p.category_id ? catMap.get(p.category_id) : undefined,
            subcategory: p.subcategory_id ? catMap.get(p.subcategory_id) : undefined
          }));
        }
      } catch (e) {
        console.error('Failed to map categories', e);
      }

      if (filters?.search) {
        const term = filters.search.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term));
      }
      return products;
    }
    return [];
  }

  static async getProductById(id: string): Promise<Product | null> {
    const response = await ApiService.getById<Product>('products', id);
    if (response.success && response.data) {
      const product = response.data;
      
      // Fetch category and subcategory details
      if (product.category_id) {
        const catRes = await ApiService.getById<Category>('categories', product.category_id);
        if (catRes.success && catRes.data) product.category = catRes.data;
      }
      if (product.subcategory_id) {
        const subRes = await ApiService.getById<Category>('categories', product.subcategory_id);
        if (subRes.success && subRes.data) product.subcategory = subRes.data;
      }
      
      return product;
    }
    return null;
  }

  static async createProduct(product: Partial<Product>): Promise<Product | null> {
    const response = await ApiService.create<Product>('products', product);
    return response.success ? response.data : null;
  }

  static async updateProduct(id: string, product: Partial<Product>): Promise<Product | null> {
    const response = await ApiService.update<Product>('products', id, {
      ...product,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
    return response.success ? response.data : null;
  }

  static async deleteProduct(id: string): Promise<boolean> {
    const response = await ApiService.delete('products', id);
    return response.success;
  }

  // Category operations
  static async getCategories(): Promise<Category[]> {
    const response = await ApiService.get<Category>('categories', {
      filters: { is_active: true },
      orderBy: { column: 'sort_order', ascending: true }
    });

    if (response.success && response.data) {
      return this.buildCategoryTree(response.data);
    }

    return [];
  }

  static async createCategory(category: Partial<Category>): Promise<Category | null> {
    const response = await ApiService.create<Category>('categories', category);
    return response.success ? response.data : null;
  }

  static async updateCategory(id: string, category: Partial<Category>): Promise<Category | null> {
    const response = await ApiService.update<Category>('categories', id, {
      ...category,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteCategory(id: string): Promise<boolean> {
    const response = await ApiService.delete('categories', id);
    return response.success;
  }

  // Inventory operations
  static async updateStock(productId: string, quantity: number, type: 'in' | 'out' | 'adjustment'): Promise<boolean> {
    try {
      // Get current product
      const product = await this.getProductById(productId);
      if (!product) return false;

      let newStock = product.current_stock;
      
      switch (type) {
        case 'in':
          newStock += quantity;
          break;
        case 'out':
          newStock -= quantity;
          break;
        case 'adjustment':
          newStock = quantity;
          break;
      }

      // Update product stock
      const updateResponse = await this.updateProduct(productId, {
        current_stock: Math.max(0, newStock)
      });

      if (!updateResponse) return false;

      // Create inventory movement record
      const movementResponse = await ApiService.create('inventory_movements', {
        product_id: productId,
        movement_type: type,
        quantity: Math.abs(quantity),
        unit_cost: product.cost_price,
        reference_type: 'manual',
        description: `Manual ${type} adjustment`
      });

      return movementResponse.success;
    } catch (error) {
      console.error('Error updating stock:', error);
      return false;
    }
  }

  static async getLowStockProducts(): Promise<Product[]> {
    const response = await ApiService.get<Product>('products', {
      filters: { is_active: true },
      orderBy: { column: 'current_stock', ascending: true }
    });

    if (response.success && response.data) {
      return response.data.filter(product => 
        product.current_stock <= product.minimum_stock
      );
    }

    return [];
  }

  // Product statistics
  static async getProductStats(): Promise<ProductStats> {
    const products = await this.getProducts({ is_active: true });
    
    const stats: ProductStats = {
      totalProducts: products.length,
      activeProducts: products.filter(p => p.is_active).length,
      lowStockProducts: products.filter(p => p.current_stock <= p.minimum_stock).length,
      outOfStockProducts: products.filter(p => p.current_stock === 0).length,
      totalValue: products.reduce((sum, p) => sum + (p.current_stock * p.cost_price), 0)
    };

    return stats;
  }

  // File upload for product images
  static async uploadProductImage(file: File, productId: string): Promise<string | null> {
    const timestamp = Date.now();
    const fileName = `products/${productId}/image_${timestamp}.${file.name.split('.').pop()}`;
    
    const response = await ApiService.uploadFile('product-images', file);
    return response.success ? response.data : null;
  }

  // Helper method to build category tree
  private static buildCategoryTree(categories: Category[]): Category[] {
    const categoryMap = new Map<string, Category>();
    const rootCategories: Category[] = [];

    // Create a map of all categories
    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Build the tree structure
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!;
      
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children!.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }
} 