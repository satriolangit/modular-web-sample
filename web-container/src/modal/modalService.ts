import type { ComponentType } from 'react';

export interface ModalComponentProps<TPayload = unknown> {
  payload: TPayload;
  close: () => void;
}

export interface ActiveModal {
  name: string;
  payload: unknown;
}

export interface ModalService {
  register<TPayload>(
    name: string,
    component: ComponentType<ModalComponentProps<TPayload>>,
  ): void;
  open(name: string, payload?: unknown): void;
  close(name?: string): void;
  isOpen(name: string): boolean;
  getSnapshot(): ActiveModal | null;
  getComponent(name: string): ComponentType<ModalComponentProps> | undefined;
  subscribe(listener: () => void): () => void;
}

export function createModalService(): ModalService {
  const registry = new Map<string, ComponentType<ModalComponentProps>>();
  const listeners = new Set<() => void>();
  let active: ActiveModal | null = null;

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    register<TPayload>(name: string, component: ComponentType<ModalComponentProps<TPayload>>) {
      if (registry.has(name)) {
        throw new Error(`[modal] "${name}" is already registered`);
      }
      registry.set(name, component as unknown as ComponentType<ModalComponentProps>);
    },
    open(name, payload) {
      if (!registry.has(name)) {
        throw new Error(`[modal] "${name}" is not registered`);
      }
      active = { name, payload };
      notify();
    },
    close(name) {
      if (!active) {
        return;
      }
      if (name && active.name !== name) {
        return;
      }
      active = null;
      notify();
    },
    isOpen: (name) => active?.name === name,
    getSnapshot: () => active,
    getComponent: (name) => registry.get(name),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
