import { useState, useEffect } from 'react';
import { apiClient, handleApiError } from '../lib/api-client';
import { User as AppUser } from '../types';

interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    role: string;
    role_name?: string;
    permissions?: string[];
    employee_id?: string;
  };
  token: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token && token !== 'undefined') {
        const apiUser = await apiClient.get<AuthResponse['user']>('/auth/me');
        setUser(mapApiUser(apiUser));
      } else {
        setLoading(false);
      }
    } catch (error) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const mapApiUser = (apiUser: AuthResponse['user']): AppUser => {
    if (!apiUser) return null as any;
    return {
      id: apiUser.id,
      email: apiUser.email,
      username: apiUser.username,
      name: `${apiUser.first_name || ''} ${apiUser.last_name || ''}`.trim() || apiUser.email,
      role: apiUser.role_name || apiUser.role,
      permissions: apiUser.permissions || [],
      created_at: new Date().toISOString(),
    };
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', {
        email,
        password,
      });

      const { user: apiUser, token } = response;

      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(apiUser));

      const mappedUser = mapApiUser(apiUser);
      setUser(mappedUser);

      return { success: true, user: mappedUser };
    } catch (error: any) {
      return { success: false, error: handleApiError(error) };
    }
  };

  const register = async (data: {
    email: string;
    username: string;
    password?: string;
    role_id: string;
    employee_id?: string;
    first_name: string;
    last_name: string;
  }) => {
    try {
      await apiClient.post('/auth/register', data);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: handleApiError(error) };
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setUser(null);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: handleApiError(error) };
    }
  };

  return {
    user,
    loading,
    login,
    register,
    logout,
  };
};