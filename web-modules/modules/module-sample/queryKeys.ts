import type { SamplePostListParams } from './services/service.sample';

export const sampleKeys = {
  all: ['module-sample', 'sample'] as const,
  users: () => [...sampleKeys.all, 'user'] as const,
  user: (id: number) => [...sampleKeys.users(), id] as const,
  posts: () => [...sampleKeys.all, 'post'] as const,
  postList: (params?: SamplePostListParams) => [...sampleKeys.posts(), 'list', params ?? {}] as const,
  post: (id: number) => [...sampleKeys.posts(), 'detail', id] as const,
};
