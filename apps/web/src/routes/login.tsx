import { createFileRoute } from '@tanstack/react-router';
import { Login, LoginError } from '@/features/auth';

export const Route = createFileRoute('/login')({
  component: Login,
  errorComponent: LoginError,
});
