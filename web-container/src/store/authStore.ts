import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { isDev } from '../env';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,
        login: async (username, password) => {
          await new Promise((resolve) => {
            setTimeout(resolve, 300);
          });
          if (!username.trim() || !password.trim()) {
            throw new Error('invalid-credentials');
          }
          set({
            user: { id: username, username, displayName: username },
            isAuthenticated: true,
          });
        },
        logout: () => {
          set({ user: null, isAuthenticated: false });
        },
      }),
      {
        name: 'container:auth',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      },
    ),
    { name: 'auth', enabled: isDev },
  ),
);
