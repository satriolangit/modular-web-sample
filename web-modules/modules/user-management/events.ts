import type { User } from './types';

export const userEvents = {
  created: 'user-management.user.created',
  updated: 'user-management.user.updated',
  deleted: 'user-management.user.deleted',
} as const;

export interface UserCreatedPayload {
  user: User;
}

export interface UserUpdatedPayload {
  id: number;
  changes: Partial<User>;
}

export interface UserDeletedPayload {
  id: number;
}
