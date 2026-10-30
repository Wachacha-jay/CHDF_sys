import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Request interceptor - Add JWT token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token && token !== 'undefined' && token !== 'null' && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors and token refresh
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isLoginEndpoint = originalRequest?.url?.includes('/auth/login');

    // Handle 401 Unauthorized or 403 Forbidden (Token expired, invalid, or account deactivated)
    // Never trigger window reload/redirect on normal /auth/login failures
    if (!isLoginEndpoint && (error.response?.status === 401 || (error.response?.status === 403 && error.response?.data?.error?.includes('deactivated')))) {
      if (!originalRequest?._retry) {
        if (originalRequest) originalRequest._retry = true;
        
        // Clear token and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        
        // Redirect to login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// API Client class
class ApiClient {
  /**
   * GET request
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.get<any>(url, config);
    return response.data?.data !== undefined ? response.data.data : response.data;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.post<any>(url, data, config);
    return response.data?.data !== undefined ? response.data.data : response.data;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.put<any>(url, data, config);
    return response.data?.data !== undefined ? response.data.data : response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.delete<any>(url, config);
    return response.data?.data !== undefined ? response.data.data : response.data;
  }

  /**
   * Upload file
   */
  async upload<T>(url: string, file: File, type: string = 'image'): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await axiosInstance.post<{ success: boolean; data: T }>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  }

  /**
   * Get raw axios instance for custom requests
   */
  getAxiosInstance(): AxiosInstance {
    return axiosInstance;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export axios instance for direct use if needed
export { axiosInstance };

// Helper function to handle API errors
export const handleApiError = (error: any): string => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};
