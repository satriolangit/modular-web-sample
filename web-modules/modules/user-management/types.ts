export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  age?: number;
  role?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  age?: number;
}

export type UpdateUserInput = Partial<CreateUserInput>;
