import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';

import { useToast } from '../hooks/useToast';
import { useAuth } from './useAuth';

const inputClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const { isAuthenticated, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await login(username, password);
      toast.success(t('login.success'));
      navigate('/', { replace: true });
    } catch {
      toast.error(t('login.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-accent via-background to-background p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-card-foreground shadow-soft">
        <span
          aria-hidden="true"
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-light text-base font-bold text-primary-foreground"
        >
          A
        </span>
        <h1 className="text-xl font-semibold">{t('login.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('login.description')}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-username" className="text-sm font-medium leading-none">
              {t('login.username')}
            </label>
            <input
              id="login-username"
              className={inputClassName}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-sm font-medium leading-none">
              {t('login.password')}
            </label>
            <input
              id="login-password"
              type="password"
              className={inputClassName}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
          >
            {isSubmitting ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
