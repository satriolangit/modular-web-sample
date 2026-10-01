import { isDev } from '@arsi/container';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface SampleUiState {
  counter: number;
  note: string;
  showDetails: boolean;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  setNote: (note: string) => void;
  toggleDetails: () => void;
}

export const useSampleStore = create<SampleUiState>()(
  devtools(
    persist(
      (set) => ({
        counter: 0,
        note: '',
        showDetails: true,
        increment: () => set((state) => ({ counter: state.counter + 1 })),
        decrement: () => set((state) => ({ counter: state.counter - 1 })),
        reset: () => set({ counter: 0, note: '', showDetails: true }),
        setNote: (note) => set({ note }),
        toggleDetails: () => set((state) => ({ showDetails: !state.showDetails })),
      }),
      { name: 'module:module-sample' },
    ),
    { name: 'module-sample', enabled: isDev },
  ),
);
