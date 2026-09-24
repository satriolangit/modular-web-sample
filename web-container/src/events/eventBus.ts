export type EventHandler<TPayload = unknown> = (payload: TPayload) => void;

export interface EventBus {
  on<TPayload = unknown>(event: string, handler: EventHandler<TPayload>): () => void;
  off<TPayload = unknown>(event: string, handler: EventHandler<TPayload>): void;
  emit<TPayload = unknown>(event: string, payload?: TPayload): void;
  clear(): void;
}

export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<EventHandler<unknown>>>();

  return {
    on<TPayload = unknown>(event: string, handler: EventHandler<TPayload>) {
      const eventHandlers = handlers.get(event) ?? new Set<EventHandler<unknown>>();
      eventHandlers.add(handler as EventHandler<unknown>);
      handlers.set(event, eventHandlers);
      return () => {
        eventHandlers.delete(handler as EventHandler<unknown>);
      };
    },
    off<TPayload = unknown>(event: string, handler: EventHandler<TPayload>) {
      handlers.get(event)?.delete(handler as EventHandler<unknown>);
    },
    emit<TPayload = unknown>(event: string, payload?: TPayload) {
      handlers.get(event)?.forEach((handler) => {
        handler(payload);
      });
    },
    clear() {
      handlers.clear();
    },
  };
}
