import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { FullPageSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '../hooks/use-auth';
import { LoginForm } from './login-form';

export function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: '/dashboard' });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <FullPageSpinner />;
  }

  return <LoginForm />;
}
