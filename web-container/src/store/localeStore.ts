import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import { isDev } from '../env';

export type Locale = 'en' | 'id';

export interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  devtools(
    persist(
      (set) => ({
        locale: 'en',
        setLocale: (locale) => {
          set({ locale });
        },
      }),
      {
        name: 'container:locale',
        storage: createJSONStorage(() => localStorage),
      },
    ),
    { name: 'locale', enabled: isDev },
  ),
);
