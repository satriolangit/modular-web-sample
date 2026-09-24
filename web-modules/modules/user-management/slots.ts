export const userSlots = {
  userTableActions: 'user-management.userTableActions',
  userDetailSidebar: 'user-management.userDetailSidebar',
} as const;

export type UserSlotName = (typeof userSlots)[keyof typeof userSlots];
