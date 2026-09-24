import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { isDev } from '../env';

export type Theme = 'light' | 'dark';

export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'light',
        setTheme: (theme) => {
          set({ theme });
        },
        toggleTheme: () => {
          set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
        },
      }),
      {
        name: 'container:theme',
        storage: createJSONStorage(() => localStorage),
      },
    ),
    { name: 'theme', enabled: isDev },
  ),
);
