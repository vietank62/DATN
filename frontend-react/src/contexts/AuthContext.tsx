import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, UserRole, CuisineType } from '../types';
import { loginUser, logoutUser, getActiveUser, fetchCuisines } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; role: UserRole; name: string }>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  cuisines: CuisineType[];
  loadingCuisines: boolean;

}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('tablenow_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [cuisines, setCuisines] = useState<CuisineType[]>([]);
  const [loadingCuisines, setLoadingCuisines] = useState<boolean>(true);


  // On mount, if we have a token try to fetch the active user
  useEffect(() => {
    const token = localStorage.getItem('tablenow_token');
    if (token && !user) {
      getActiveUser()
        .then((u) => {
          setUser(u);
          localStorage.setItem('tablenow_user', JSON.stringify(u));
          localStorage.setItem('tablenow_user_id', u.id);
        })
        .catch(() => {
          // Token expired / invalid
          localStorage.removeItem('tablenow_token');
          localStorage.removeItem('tablenow_user');
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCuisines()
      .then((data) => {
        setCuisines(data);
      })
      .catch((err) => {
        console.error('Failed to fetch cuisines:', err);
      })
      .finally(() => {
        setLoadingCuisines(false);
      });
  }, []);


  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; role: UserRole; name: string }> => {
    try {
      const { user: loggedInUser } = await loginUser(email, password);
      setUser(loggedInUser);
      localStorage.setItem('tablenow_user', JSON.stringify(loggedInUser));
      localStorage.setItem('tablenow_user_id', loggedInUser.id);
      return { success: true, role: loggedInUser.role, name: loggedInUser.name };
    } catch (err: any) {
      throw new Error(err.message || 'Đăng nhập thất bại');
    }
  }, []);
  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    localStorage.removeItem('tablenow_user');
    localStorage.removeItem('tablenow_user_id');
    localStorage.removeItem('tablenow_token');
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('tablenow_user', JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser, cuisines, loadingCuisines }}>
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
