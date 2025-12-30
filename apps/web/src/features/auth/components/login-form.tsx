import { loginSchema, signUpSchema, z } from '@repo/shared-types/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '../hooks/use-auth';

type FieldErrors = {
  email?: string[];
  password?: string[];
};

type AuthState = {
  fieldErrors: FieldErrors;
  formError: string | null;
};

const initialState: AuthState = {
  fieldErrors: {},
  formError: null,
};

function SubmitButton({ isSignUp }: { isSignUp: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useTranslation();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t('common.pleaseWait') : isSignUp ? t('auth.signUp') : t('auth.signIn')}
    </Button>
  );
}

export function LoginForm() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);

  const authAction = async (_prevState: AuthState, formData: FormData): Promise<AuthState> => {
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    // Use appropriate schema based on mode
    const schema = isSignUp ? signUpSchema : loginSchema;
    const result = schema.safeParse(rawData);

    // Return field errors if validation fails
    if (!result.success) {
      const flattened = z.flattenError(result.error);
      return {
        fieldErrors: flattened.fieldErrors,
        formError: null,
      };
    }

    try {
      if (isSignUp) {
        await signUp(result.data.email, result.data.password);
      } else {
        await signIn(result.data.email, result.data.password);
      }
      navigate({ to: '/dashboard' });
      return initialState;
    } catch (err) {
      return {
        fieldErrors: {},
        formError: err instanceof Error ? err.message : t('auth.authFailed'),
      };
    }
  };

  const [state, formAction] = useActionState(authAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl">{t('common.appName')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                aria-describedby={state.fieldErrors.email ? 'email-error' : undefined}
                aria-invalid={!!state.fieldErrors.email}
              />
              {state.fieldErrors.email && (
                <p id="email-error" className="text-destructive text-xs">
                  {state.fieldErrors.email[0]}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
                aria-invalid={!!state.fieldErrors.password}
              />
              {state.fieldErrors.password && (
                <p id="password-error" className="text-destructive text-xs">
                  {state.fieldErrors.password[0]}
                </p>
              )}
            </div>
            {state.formError && <p className="text-destructive text-xs">{state.formError}</p>}
            <SubmitButton isSignUp={isSignUp} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full"
            >
              {isSignUp ? t('auth.hasAccount') : t('auth.noAccount')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
