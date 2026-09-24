export interface MenuItemDefinition {
  path: string;
  label: string;
  namespace?: string;
  order?: number;
}

export interface MenuRegistry {
  register(item: MenuItemDefinition): void;
  getAll(): MenuItemDefinition[];
}

export function createMenuRegistry(): MenuRegistry {
  const items = new Map<string, MenuItemDefinition>();

  return {
    register(item) {
      if (items.has(item.path)) {
        throw new Error(`[menu] menu item "${item.path}" is already registered`);
      }
      items.set(item.path, item);
    },
    getAll: () => [...items.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  };
}
