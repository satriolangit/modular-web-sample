import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { createUserService } from './service.user';

function createMockApi() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

describe('createUserService', () => {
  it('lists users with pagination params', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { users: [], total: 0, skip: 10, limit: 5 } });
    const service = createUserService(api as unknown as AxiosInstance);

    await service.list({ limit: 5, skip: 10 });

    expect(api.get).toHaveBeenCalledWith('/users', { params: { limit: 5, skip: 10 } });
  });

  it('uses the search endpoint when a query is provided', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { users: [], total: 0, skip: 0, limit: 10 } });
    const service = createUserService(api as unknown as AxiosInstance);

    await service.list({ search: 'ada' });

    expect(api.get).toHaveBeenCalledWith('/users/search', {
      params: { limit: 10, skip: 0, q: 'ada' },
    });
  });

  it('fetches a user by id', async () => {
    const api = createMockApi();
    api.get.mockResolvedValue({ data: { id: 7 } });
    const service = createUserService(api as unknown as AxiosInstance);

    await service.getById(7);

    expect(api.get).toHaveBeenCalledWith('/users/7');
  });

  it('creates a user', async () => {
    const api = createMockApi();
    api.post.mockResolvedValue({ data: { id: 101 } });
    const service = createUserService(api as unknown as AxiosInstance);

    await service.create({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' });

    expect(api.post).toHaveBeenCalledWith('/users/add', {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
  });

  it('updates a user', async () => {
    const api = createMockApi();
    api.put.mockResolvedValue({ data: { id: 7 } });
    const service = createUserService(api as unknown as AxiosInstance);

    await service.update(7, { email: 'new@example.com' });

    expect(api.put).toHaveBeenCalledWith('/users/7', { email: 'new@example.com' });
  });

  it('removes a user', async () => {
    const api = createMockApi();
    api.delete.mockResolvedValue({ data: { id: 7 } });
    const service = createUserService(api as unknown as AxiosInstance);

    await service.remove(7);

    expect(api.delete).toHaveBeenCalledWith('/users/7');
  });
});
