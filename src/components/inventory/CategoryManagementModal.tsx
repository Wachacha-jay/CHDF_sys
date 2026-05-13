import React, { useState, useEffect } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CategoryService } from '../../services/categoryService';
import type { Category } from '../../types';

interface CategoryManagementModalProps {
  onClose: () => void;
  onCategoryUpdate: () => void;
}

const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({ onClose, onCategoryUpdate }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    parent_id: '',
    is_active: true
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const allCategories = await CategoryService.getCategories();
      setCategories(allCategories);
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let success = false;
      if (selectedCategory) {
        const updated = await CategoryService.updateCategory(selectedCategory.id, formData);
        success = !!updated;
      } else {
        const created = await CategoryService.createCategory(formData);
        success = !!created;
      }

      if (success) {
        toast.success(selectedCategory ? 'Category updated successfully' : 'Category added successfully');
        setShowForm(false);
        resetForm();
        loadCategories();
      } else {
        toast.error(selectedCategory ? 'Failed to update category' : 'Failed to add category');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      code: '',
      parent_id: '',
      is_active: true
    });
    setSelectedCategory(null);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This will also delete all subcategories.')) {
      return;
    }

    try {
      const success = await CategoryService.deleteCategory(categoryId);
      if (success) {
        toast.success('Category deleted successfully');
        loadCategories();
      } else {
        toast.error('Failed to delete category');
      }
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const seedCategories = async () => {
    try {
      await CategoryService.seedSampleCategories();
      toast.success('Sample categories seeded successfully');
      loadCategories();
    } catch (error) {
      toast.error('Failed to seed categories');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Category Management</h3>
          <div className="flex space-x-2">
            <button
              onClick={seedCategories}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Seed Sample Categories
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                resetForm();
              }}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Add Category
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>

        {showForm ? (
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              {selectedCategory ? 'Edit Category' : 'Add New Category'}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Category
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, parent_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Main Category</option>
                  {categories.filter(c => !c.parent_id).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Active</span>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedCategory ? 'Update' : 'Add'} Category
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((category) => (
                  <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{category.name}</h4>
                        {category.code && (
                          <p className="text-sm text-gray-500">Code: {category.code}</p>
                        )}
                        {category.description && (
                          <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedCategory(category);
                            setFormData({
                              name: category.name,
                              description: category.description || '',
                              code: category.code || '',
                              parent_id: category.parent_id || '',
                              is_active: category.is_active
                            });
                            setShowForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    {category.children && category.children.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Subcategories:</p>
                        <div className="space-y-1">
                          {category.children.map((child) => (
                            <div key={child.id} className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                              <span>{child.name}</span>
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => {
                                    setSelectedCategory(child);
                                    setFormData({
                                      name: child.name,
                                      description: child.description || '',
                                      code: child.code || '',
                                      parent_id: child.parent_id || '',
                                      is_active: child.is_active
                                    });
                                    setShowForm(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Edit className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleDelete(child.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManagementModal; 