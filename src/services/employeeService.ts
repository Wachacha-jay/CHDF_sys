import { ApiService } from './api';
import { Employee } from '../types';

export interface EmployeeFilters {
  department?: string;
  position?: string;
  is_active?: boolean;
  search?: string;
}

export interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  departments: { name: string; count: number }[];
  totalSalary: number;
  averageSalary: number;
}

export class EmployeeService {
  // Employee CRUD operations
  static async getEmployees(filters?: EmployeeFilters, options?: {
    limit?: number;
    offset?: number;
    orderBy?: { column: string; ascending?: boolean };
  }): Promise<Employee[]> {
    let apiFilters: Record<string, any> = {};
    
    if (filters?.department) apiFilters.department = filters.department;
    if (filters?.position) apiFilters.position = filters.position;
    if (filters?.is_active !== undefined) apiFilters.is_active = filters.is_active;

    const response = await ApiService.get<Employee>('employees', {
      filters: apiFilters,
      orderBy: options?.orderBy || { column: 'first_name', ascending: true },
      limit: options?.limit,
      offset: options?.offset
    });

    if (response.success && response.data) {
      let employees = response.data;
      
      // Apply search filter
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        employees = employees.filter(employee => 
          employee.first_name.toLowerCase().includes(searchTerm) ||
          employee.last_name.toLowerCase().includes(searchTerm) ||
          employee.email.toLowerCase().includes(searchTerm) ||
          employee.code.toLowerCase().includes(searchTerm) ||
          employee.department?.toLowerCase().includes(searchTerm) ||
          employee.position?.toLowerCase().includes(searchTerm)
        );
      }

      return employees;
    }

    return [];
  }

  static async getEmployeeById(id: string): Promise<Employee | null> {
    const response = await ApiService.getById<Employee>('employees', id);
    return response.success ? response.data : null;
  }

  static async createEmployee(employee: Partial<Employee>): Promise<Employee | null> {
    const response = await ApiService.create<Employee>('employees', employee);
    return response.success ? response.data : null;
  }

  static async updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee | null> {
    const response = await ApiService.update<Employee>('employees', id, {
      ...employee,
      updated_at: new Date().toISOString()
    });
    return response.success ? response.data : null;
  }

  static async deleteEmployee(id: string): Promise<boolean> {
    const response = await ApiService.delete('employees', id);
    return response.success;
  }

  // Employee statistics
  static async getEmployeeStats(): Promise<EmployeeStats> {
    const employees = await this.getEmployees({ is_active: true });
    
    const departments = new Map<string, number>();
    let totalSalary = 0;
    let activeCount = 0;

    employees.forEach(employee => {
      if (employee.is_active) {
        activeCount++;
        if (employee.salary) {
          totalSalary += employee.salary;
        }
        if (employee.department) {
          departments.set(employee.department, (departments.get(employee.department) || 0) + 1);
        }
      }
    });

    const departmentStats = Array.from(departments.entries()).map(([name, count]) => ({
      name,
      count
    }));

    const stats: EmployeeStats = {
      totalEmployees: employees.length,
      activeEmployees: activeCount,
      departments: departmentStats,
      totalSalary,
      averageSalary: activeCount > 0 ? totalSalary / activeCount : 0
    };

    return stats;
  }

  // Department operations
  static async getDepartments(): Promise<string[]> {
    const employees = await this.getEmployees({ is_active: true });
    const departments = new Set<string>();
    
    employees.forEach(employee => {
      if (employee.department) {
        departments.add(employee.department);
      }
    });

    return Array.from(departments).sort();
  }

  // Position operations
  static async getPositions(): Promise<string[]> {
    const employees = await this.getEmployees({ is_active: true });
    const positions = new Set<string>();
    
    employees.forEach(employee => {
      if (employee.position) {
        positions.add(employee.position);
      }
    });

    return Array.from(positions).sort();
  }

  // Employee search by email (for user association)
  static async getEmployeeByEmail(email: string): Promise<Employee | null> {
    const response = await ApiService.get<Employee>('employees', {
      filters: { email },
      limit: 1
    });

    if (response.success && response.data && response.data.length > 0) {
      return response.data[0];
    }

    return null;
  }

  // Employee search by user ID
  static async getEmployeeByUserId(userId: string): Promise<Employee | null> {
    const response = await ApiService.get<Employee>('employees', {
      filters: { user_id: userId },
      limit: 1
    });

    if (response.success && response.data && response.data.length > 0) {
      return response.data[0];
    }

    return null;
  }

  // Bulk operations
  static async bulkUpdateEmployees(updates: Array<{ id: string; updates: Partial<Employee> }>): Promise<boolean> {
    try {
      for (const update of updates) {
        await this.updateEmployee(update.id, update.updates);
      }
      return true;
    } catch (error) {
      console.error('Error in bulk update:', error);
      return false;
    }
  }

  // Employee import/export
  static async exportEmployees(): Promise<Employee[]> {
    return await this.getEmployees();
  }

  // Employee validation
  static validateEmployee(employee: Partial<Employee>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!employee.first_name?.trim()) {
      errors.push('First name is required');
    }

    if (!employee.last_name?.trim()) {
      errors.push('Last name is required');
    }

    if (!employee.email?.trim()) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
      errors.push('Invalid email format');
    }

    if (employee.salary && employee.salary < 0) {
      errors.push('Salary cannot be negative');
    }

    if (employee.hire_date && new Date(employee.hire_date) > new Date()) {
      errors.push('Hire date cannot be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 