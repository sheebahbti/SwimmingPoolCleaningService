import { createContext } from 'react';

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'TECHNICIAN' | 'CUSTOMER';
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; name: string; phone: string; password: string }) => Promise<void>;
  updateUser: (updates: Partial<Pick<User, 'name' | 'phone'>>) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);
