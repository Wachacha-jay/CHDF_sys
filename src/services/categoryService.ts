import { ApiService } from './api';
import { Category } from '../types';

export interface CategoryFilters {
  parent_id?: string;
  is_active?: boolean;
  search?: string;
}

export class CategoryService {
  // Get all categories with optional filters
  static async getCategories(filters?: CategoryFilters): Promise<Category[]> {
    const select = `
      *,
      children:categories!categories_parent_id_fkey(*),
      parent:categories!categories_parent_id_fkey(*)
    `;

    let apiFilters: Record<string, any> = {};
    
    if (filters?.parent_id !== undefined) {
      apiFilters.parent_id = filters.parent_id;
    }
    if (filters?.is_active !== undefined) {
      apiFilters.is_active = filters.is_active;
    }

    const response = await ApiService.get<Category>('categories', {
      select,
      filters: apiFilters,
      orderBy: { column: 'sort_order', ascending: true }
    });

    if (response.success && response.data) {
      let categories = response.data;
      
      // Apply search filter if provided
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        categories = categories.filter(category => 
          category.name.toLowerCase().includes(searchTerm) ||
          category.description?.toLowerCase().includes(searchTerm) ||
          category.code?.toLowerCase().includes(searchTerm)
        );
      }

      return this.buildCategoryTree(categories);
    }

    return [];
  }

  // Get main categories (parent_id is null)
  static async getMainCategories(): Promise<Category[]> {
    return this.getCategories({ parent_id: null, is_active: true });
  }

  // Get subcategories for a specific parent category
  static async getSubcategories(parentId: string): Promise<Category[]> {
    return this.getCategories({ parent_id: parentId, is_active: true });
  }

  // Get category by ID
  static async getCategoryById(id: string): Promise<Category | null> {
    const select = `
      *,
      children:categories!categories_parent_id_fkey(*),
      parent:categories!categories_parent_id_fkey(*)
    `;

    const response = await ApiService.getById<Category>('categories', id, select);
    return response.success ? response.data : null;
  }

  // Create new category
  static async createCategory(category: Partial<Category>): Promise<Category | null> {
    const response = await ApiService.create<Category>('categories', {
      ...category,
      is_active: category.is_active ?? true,
      sort_order: category.sort_order ?? 0
    });
    return response.success ? response.data : null;
  }

  // Update category
  static async updateCategory(id: string, category: Partial<Category>): Promise<Category | null> {
    const response = await ApiService.update<Category>('categories', id, {
      ...category,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  // Delete category
  static async deleteCategory(id: string): Promise<boolean> {
    const response = await ApiService.delete('categories', id);
    return response.success;
  }

  // Build hierarchical category tree
  private static buildCategoryTree(categories: Category[]): Category[] {
    const categoryMap = new Map<string, Category>();
    const rootCategories: Category[] = [];

    // First pass: create a map of all categories
    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Second pass: build the tree structure
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)!;
      
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(categoryWithChildren);
        } else {
          // If parent is not in the dataset, treat this as a root node
          rootCategories.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }

  // Seed sample categories
  static async seedSampleCategories(): Promise<void> {
    const sampleCategories = [
      // Main Categories
      { name: 'Electronics', description: 'Electronic devices and accessories', code: 'ELEC' },
      { name: 'Clothing', description: 'Apparel and fashion items', code: 'CLTH' },
      { name: 'Home & Garden', description: 'Home improvement and garden supplies', code: 'HOME' },
      { name: 'Sports & Outdoors', description: 'Sports equipment and outdoor gear', code: 'SPRT' },
      { name: 'Books & Media', description: 'Books, movies, and media content', code: 'BOOK' },
      { name: 'Food & Beverages', description: 'Food items and beverages', code: 'FOOD' },
      { name: 'Health & Beauty', description: 'Health and beauty products', code: 'HLTH' },
      { name: 'Automotive', description: 'Automotive parts and accessories', code: 'AUTO' },
    ];

    for (const category of sampleCategories) {
      await this.createCategory(category);
    }

    // Get the created main categories to add subcategories
    const mainCategories = await this.getMainCategories();
    
    const subcategories = [
      // Electronics subcategories
      { name: 'Smartphones', parent_id: mainCategories.find(c => c.name === 'Electronics')?.id, code: 'ELEC-SMART' },
      { name: 'Laptops', parent_id: mainCategories.find(c => c.name === 'Electronics')?.id, code: 'ELEC-LAPTOP' },
      { name: 'Tablets', parent_id: mainCategories.find(c => c.name === 'Electronics')?.id, code: 'ELEC-TABLET' },
      { name: 'Accessories', parent_id: mainCategories.find(c => c.name === 'Electronics')?.id, code: 'ELEC-ACC' },
      
      // Clothing subcategories
      { name: 'Men\'s Clothing', parent_id: mainCategories.find(c => c.name === 'Clothing')?.id, code: 'CLTH-MEN' },
      { name: 'Women\'s Clothing', parent_id: mainCategories.find(c => c.name === 'Clothing')?.id, code: 'CLTH-WOMEN' },
      { name: 'Kids\' Clothing', parent_id: mainCategories.find(c => c.name === 'Clothing')?.id, code: 'CLTH-KIDS' },
      { name: 'Shoes', parent_id: mainCategories.find(c => c.name === 'Clothing')?.id, code: 'CLTH-SHOES' },
      
      // Home & Garden subcategories
      { name: 'Furniture', parent_id: mainCategories.find(c => c.name === 'Home & Garden')?.id, code: 'HOME-FURN' },
      { name: 'Kitchen & Dining', parent_id: mainCategories.find(c => c.name === 'Home & Garden')?.id, code: 'HOME-KITCH' },
      { name: 'Garden Tools', parent_id: mainCategories.find(c => c.name === 'Home & Garden')?.id, code: 'HOME-GARDEN' },
      { name: 'Lighting', parent_id: mainCategories.find(c => c.name === 'Home & Garden')?.id, code: 'HOME-LIGHT' },
      
      // Sports & Outdoors subcategories
      { name: 'Fitness Equipment', parent_id: mainCategories.find(c => c.name === 'Sports & Outdoors')?.id, code: 'SPRT-FITNESS' },
      { name: 'Team Sports', parent_id: mainCategories.find(c => c.name === 'Sports & Outdoors')?.id, code: 'SPRT-TEAM' },
      { name: 'Outdoor Recreation', parent_id: mainCategories.find(c => c.name === 'Sports & Outdoors')?.id, code: 'SPRT-OUTDOOR' },
      { name: 'Camping Gear', parent_id: mainCategories.find(c => c.name === 'Sports & Outdoors')?.id, code: 'SPRT-CAMP' },
      
      // Food & Beverages subcategories
      { name: 'Fresh Produce', parent_id: mainCategories.find(c => c.name === 'Food & Beverages')?.id, code: 'FOOD-FRESH' },
      { name: 'Dairy & Eggs', parent_id: mainCategories.find(c => c.name === 'Food & Beverages')?.id, code: 'FOOD-DAIRY' },
      { name: 'Beverages', parent_id: mainCategories.find(c => c.name === 'Food & Beverages')?.id, code: 'FOOD-BEVERAGE' },
      { name: 'Snacks', parent_id: mainCategories.find(c => c.name === 'Food & Beverages')?.id, code: 'FOOD-SNACKS' },
      
      // Health & Beauty subcategories
      { name: 'Personal Care', parent_id: mainCategories.find(c => c.name === 'Health & Beauty')?.id, code: 'HLTH-CARE' },
      { name: 'Cosmetics', parent_id: mainCategories.find(c => c.name === 'Health & Beauty')?.id, code: 'HLTH-COSMETIC' },
      { name: 'Vitamins & Supplements', parent_id: mainCategories.find(c => c.name === 'Health & Beauty')?.id, code: 'HLTH-VITAMIN' },
      { name: 'Medical Supplies', parent_id: mainCategories.find(c => c.name === 'Health & Beauty')?.id, code: 'HLTH-MEDICAL' },
    ];

    for (const subcategory of subcategories) {
      if (subcategory.parent_id) {
        await this.createCategory(subcategory);
      }
    }
  }
} 