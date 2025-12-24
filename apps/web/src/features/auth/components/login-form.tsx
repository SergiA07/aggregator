import { loginSchema, signUpSchema, z } from '@repo/shared-types/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
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
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
    >
      {pending ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
    </button>
  );
}

export function LoginForm() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
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
        formError: err instanceof Error ? err.message : 'Authentication failed',
      };
    }
  };

  const [state, formAction] = useActionState(authAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Portfolio Aggregator</h1>
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              aria-describedby={state.fieldErrors.email ? 'email-error' : undefined}
              aria-invalid={!!state.fieldErrors.email}
              className={`w-full px-3 py-2 bg-slate-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                state.fieldErrors.email ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {state.fieldErrors.email && (
              <p id="email-error" className="mt-1 text-red-400 text-sm">
                {state.fieldErrors.email[0]}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              aria-describedby={state.fieldErrors.password ? 'password-error' : undefined}
              aria-invalid={!!state.fieldErrors.password}
              className={`w-full px-3 py-2 bg-slate-700 border rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                state.fieldErrors.password ? 'border-red-500' : 'border-slate-600'
              }`}
            />
            {state.fieldErrors.password && (
              <p id="password-error" className="mt-1 text-red-400 text-sm">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>
          {state.formError && <p className="text-red-400 text-sm">{state.formError}</p>}
          <SubmitButton isSignUp={isSignUp} />
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full py-2 px-4 text-slate-400 hover:text-white transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
