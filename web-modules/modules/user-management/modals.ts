export const userModals = {
  create: 'user-management.create',
} as const;

export type UserModalName = (typeof userModals)[keyof typeof userModals];
