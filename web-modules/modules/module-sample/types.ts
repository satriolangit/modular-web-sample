export interface SampleUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface SamplePost {
  id: number;
  title: string;
  body: string;
  userId: number;
}

export interface SamplePostListResponse {
  posts: SamplePost[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateSamplePostInput {
  title: string;
  body: string;
  userId: number;
}
