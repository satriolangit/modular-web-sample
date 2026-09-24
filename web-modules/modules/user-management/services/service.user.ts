import type { AxiosInstance } from 'axios';

import type { CreateUserInput, UpdateUserInput, User, UserListResponse } from '../types';

export interface UserListParams {
  limit?: number;
  skip?: number;
  search?: string;
}

export function createUserService(api: AxiosInstance) {
  return {
    async list(params: UserListParams = {}): Promise<UserListResponse> {
      const { limit = 10, skip = 0, search } = params;
      const res = await api.get<UserListResponse>(search ? '/users/search' : '/users', {
        params: { limit, skip, ...(search ? { q: search } : {}) },
      });
      return res.data;
    },

    async getById(id: string | number): Promise<User> {
      const res = await api.get<User>(`/users/${id}`);
      return res.data;
    },

    async create(input: CreateUserInput): Promise<User> {
      const res = await api.post<User>('/users/add', input);
      return res.data;
    },

    async update(id: string | number, input: UpdateUserInput): Promise<User> {
      const res = await api.put<User>(`/users/${id}`, input);
      return res.data;
    },

    async remove(id: string | number): Promise<User> {
      const res = await api.delete<User>(`/users/${id}`);
      return res.data;
    },
  };
}

export type UserService = ReturnType<typeof createUserService>;
