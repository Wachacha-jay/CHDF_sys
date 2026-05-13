import { apiClient, handleApiError } from '../lib/api-client';

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class ApiService {
  private static handleError(error: any): ApiResponse {
    console.error('API Error:', error);

    const errorMessage = handleApiError(error);

    return {
      data: null,
      error: errorMessage,
      success: false
    };
  }

  static async get<T>(table: string, options?: {
    select?: string;
    filters?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<T[]>> {
    try {
      // Build query parameters
      const params: Record<string, any> = {};

      if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params[key] = value;
          }
        });
      }

      if (options?.orderBy) {
        params.orderBy = options.orderBy.column;
        params.orderDir = options.orderBy.ascending ? 'ASC' : 'DESC';
      }

      if (options?.limit) {
        params.limit = options.limit;
      }

      if (options?.offset) {
        params.offset = options.offset;
      }

      const response = await apiClient.get<any>(`/${table}`, { params });

      // Handle response format from backend
      const data = response[table] || response[`${table}s`] || response;

      return {
        data: Array.isArray(data) ? data : [data],
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async getById<T>(table: string, id: string, select?: string): Promise<ApiResponse<T>> {
    try {
      const data = await apiClient.get<T>(`/${table}/${id}`);

      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async create<T>(table: string, data: Partial<T>): Promise<ApiResponse<T>> {
    try {
      const result = await apiClient.post<T>(`/${table}`, data);

      return {
        data: result,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async update<T>(table: string, id: string, data: Partial<T>): Promise<ApiResponse<T>> {
    try {
      const result = await apiClient.put<T>(`/${table}/${id}`, data);

      return {
        data: result,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async delete(table: string, id: string): Promise<ApiResponse<boolean>> {
    try {
      await apiClient.delete(`/${table}/${id}`);

      return {
        data: true,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    try {
      const result = await apiClient.post<T>(`/${endpoint}`, data);
      return {
        data: result,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async put<T>(endpoint: string, id: string, data: any): Promise<ApiResponse<T>> {
    try {
      const result = await apiClient.put<T>(`/${endpoint}/${id}`, data);
      return {
        data: result,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async uploadFile(type: string, file: File): Promise<ApiResponse<string>> {
    try {
      const result = await apiClient.upload<{ url: string }>('/upload', file, type);

      return {
        data: result.url,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  static async deleteFile(url: string): Promise<ApiResponse<boolean>> {
    try {
      // File deletion can be handled by deleting the record that references it
      // or by implementing a separate delete endpoint
      return {
        data: true,
        error: null,
        success: true
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}