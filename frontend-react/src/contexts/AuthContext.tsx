import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, UserRole } from '../types';
import { mockUsers } from '../data/restaurants';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; role: UserRole }>;
  loginAsRole: (role: UserRole) => void;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_ACCOUNTS: Record<string, { password: string; user: User }> = {
  'a@gmail.com': {
    password: 'customer123',
    user: mockUsers.find((u) => u.email === 'a@gmail.com')!,
  },
  'b@gmail.com': {
    password: 'customer123',
    user: mockUsers.find((u) => u.email === 'b@gmail.com')!,
  },
  'c@gmail.com': {
    password: 'manager123',
    user: mockUsers.find((u) => u.email === 'c@gmail.com')!,
  },
  'manager@tablenow.vn': {
    password: 'manager123',
    user: { id: 'U3', name: 'Lê Văn C', email: 'manager@tablenow.vn', phone: '0923456789', role: 'manager' as UserRole, avatar: '' },
  },
  'admin@tablenow.vn': {
    password: 'admin123',
    user: mockUsers.find((u) => u.email === 'admin@tablenow.vn')!,
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('tablenow_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(async (email: string, _password: string): Promise<{ success: boolean; role: UserRole }> => {
    await new Promise((r) => setTimeout(r, 600));

    const account = DEMO_ACCOUNTS[email];
    if (account) {
      setUser(account.user);
      localStorage.setItem('tablenow_user', JSON.stringify(account.user));
      return { success: true, role: account.user.role };
    }

    // Fallback: detect role from email
    let role: UserRole = 'customer';
    if (email.includes('admin')) role = 'admin';
    else if (email.includes('manager')) role = 'manager';

    const fallbackUser: User = {
      id: 'U_' + Date.now(),
      name: email.split('@')[0],
      email,
      phone: '',
      role,
      avatar: '',
    };
    setUser(fallbackUser);
    localStorage.setItem('tablenow_user', JSON.stringify(fallbackUser));
    return { success: true, role };
  }, []);

  const loginAsRole = useCallback((role: UserRole) => {
    const roleUsers: Record<UserRole, User> = {
      customer: DEMO_ACCOUNTS['a@gmail.com'].user,
      manager: DEMO_ACCOUNTS['manager@tablenow.vn'].user,
      admin: DEMO_ACCOUNTS['admin@tablenow.vn'].user,
    };
    const u = roleUsers[role];
    setUser(u);
    localStorage.setItem('tablenow_user', JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('tablenow_user');
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('tablenow_user', JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, loginAsRole, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
