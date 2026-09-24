import type { AuthUser } from '../store/authStore';
import { useAuthStore } from '../store/authStore';

export function useAuth(): {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
} {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  return { user, isAuthenticated, login, logout };
}
