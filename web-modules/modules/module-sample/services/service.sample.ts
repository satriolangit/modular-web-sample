import type { AxiosInstance } from 'axios';

import type {
  CreateSamplePostInput,
  SamplePost,
  SamplePostListResponse,
  SampleUser,
} from '../types';

export interface SamplePostListParams {
  limit?: number;
  skip?: number;
}

export function createSampleService(api: AxiosInstance) {
  return {
    async getUser(id: number): Promise<SampleUser> {
      const res = await api.get<SampleUser>(`/users/${id}`);
      return res.data;
    },

    async listPosts(params: SamplePostListParams = {}): Promise<SamplePostListResponse> {
      const { limit = 5, skip = 0 } = params;
      const res = await api.get<SamplePostListResponse>('/posts', {
        params: { limit, skip },
      });
      return res.data;
    },

    async getPost(id: number): Promise<SamplePost> {
      const res = await api.get<SamplePost>(`/posts/${id}`);
      return res.data;
    },

    async createPost(input: CreateSamplePostInput): Promise<SamplePost> {
      const res = await api.post<SamplePost>('/posts/add', input);
      return res.data;
    },
  };
}

export type SampleService = ReturnType<typeof createSampleService>;
