import { create } from 'zustand';
import type { User } from '../types';
import * as api from '../api/mock';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (email: string, password: string) => {
    const user = await api.login(email, password);
    set({ user, isAuthenticated: true });
  },
  register: async (email: string, password: string) => {
    const user = await api.register(email, password);
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
