import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types/auth';
import { api } from '../services/api';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext } from './AuthContext';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await axios.get('/v1/auth/active-user');
          setUser(response.data);
        } catch (error: unknown) {
          const message = axios.isAxiosError(error)
            ? error.response?.data?.detail
            : undefined;
          toast.error(message || "Phiên đăng nhập hết hạn hoặc lỗi xác thực");
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/v1/auth/logout');
      toast.success("Đăng xuất thành công");
    } catch (e: unknown) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.detail
        : undefined;
      toast.error(message || "Đăng xuất thất bại");
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isCustomer = user?.role === 'customer' || !user;

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoading, login, logout, setUser,
      isAdmin, isManager, isCustomer
    }}>
      {children}
    </AuthContext.Provider>
  );
};
