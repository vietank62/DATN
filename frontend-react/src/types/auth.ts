export interface User {
  userId: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar?: string | null;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCustomer: boolean;

  login: (token: string, userData: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export interface AuthRequestConfig {
  _retry?: boolean;
  headers?: Record<string, string>;
  url?: string;
};
