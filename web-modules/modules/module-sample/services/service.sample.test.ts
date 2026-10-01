import type { AxiosInstance } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleService } from './service.sample';

const api = {
  get: vi.fn(),
  post: vi.fn(),
} as unknown as AxiosInstance;

describe('sample service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a user by id', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { id: 2, firstName: 'Ada' } });
    const service = createSampleService(api);

    const user = await service.getUser(2);

    expect(api.get).toHaveBeenCalledWith('/users/2');
    expect(user).toEqual({ id: 2, firstName: 'Ada' });
  });

  it('lists posts with pagination params', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { posts: [], total: 0 } });
    const service = createSampleService(api);

    await service.listPosts({ limit: 5, skip: 10 });

    expect(api.get).toHaveBeenCalledWith('/posts', { params: { limit: 5, skip: 10 } });
  });

  it('creates a post', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 1 } });
    const service = createSampleService(api);

    await service.createPost({ title: 't', body: 'b', userId: 1 });

    expect(api.post).toHaveBeenCalledWith('/posts/add', { title: 't', body: 'b', userId: 1 });
  });
});
