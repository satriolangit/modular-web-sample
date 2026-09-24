import type { ComponentType } from 'react';

export interface SlotRegistry {
  register<TProps>(name: string, component: ComponentType<TProps>): void;
  get<TProps>(name: string): ComponentType<TProps> | undefined;
  has(name: string): boolean;
}

type StoredSlot = ComponentType<never>;

export function createSlotRegistry(): SlotRegistry {
  const slots = new Map<string, StoredSlot>();

  return {
    register<TProps>(name: string, component: ComponentType<TProps>) {
      if (slots.has(name)) {
        throw new Error(`[slots] slot "${name}" already has a component registered`);
      }
      slots.set(name, component as unknown as StoredSlot);
    },
    get<TProps>(name: string) {
      return slots.get(name) as unknown as ComponentType<TProps> | undefined;
    },
    has: (name) => slots.has(name),
  };
}
