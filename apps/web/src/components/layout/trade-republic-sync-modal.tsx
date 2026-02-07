import type { ImportResult } from '@repo/shared-types';
import {
  AlertTriangle,
  Check,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Smartphone,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, type TRSyncResponse } from '@/lib/api/client';
import { useImportTradeRepublic } from '@/lib/api/queries/import';
import { cn } from '@/lib/utils';

interface TradeRepublicSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SyncStep = 'credentials' | 'verification' | 'syncing' | 'importing' | 'result';

interface SyncState {
  step: SyncStep;
  sessionId: string | null;
  expiresAt: number | null;
  error: string | null;
  syncData: TRSyncResponse | null;
  importResult: ImportResult | null;
}

const initialState: SyncState = {
  step: 'credentials',
  sessionId: null,
  expiresAt: null,
  error: null,
  syncData: null,
  importResult: null,
};

export function TradeRepublicSyncModal({ isOpen, onClose }: TradeRepublicSyncModalProps) {
  const [state, setState] = useState<SyncState>(initialState);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // TanStack Query mutation for importing data
  const importMutation = useImportTradeRepublic();

  // Refs for secure input handling
  const pinInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Cleanup session on unmount or close
  const cleanupSession = useCallback(async () => {
    if (state.sessionId) {
      try {
        await api.tradeRepublic.cancelSession(state.sessionId);
      } catch {
        // Ignore errors on cleanup
      }
    }
  }, [state.sessionId]);

  // Handle modal close - cleanup and reset
  const handleClose = useCallback(() => {
    cleanupSession();
    setState(initialState);
    setPhoneNumber('');
    setPin('');
    setVerifyCode('');
    setIsLoading(false);
    onClose();
  }, [cleanupSession, onClose]);

  // Countdown timer for session expiry
  useEffect(() => {
    if (!state.expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((state.expiresAt! - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setState((prev) => ({
          ...prev,
          error: 'Session expired. Please start again.',
          step: 'credentials',
          sessionId: null,
          expiresAt: null,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.expiresAt]);

  // Step 1: Submit credentials
  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, error: null }));
    setIsLoading(true);

    try {
      const response = await api.tradeRepublic.initLogin(phoneNumber, pin);

      // Clear PIN from memory immediately after sending
      setPin('');
      if (pinInputRef.current) {
        pinInputRef.current.value = '';
      }

      setState((prev) => ({
        ...prev,
        step: 'verification',
        sessionId: response.session_id,
        expiresAt: Date.now() + response.expires_in_seconds * 1000,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initiate login',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Submit verification code
  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.sessionId) return;

    setState((prev) => ({ ...prev, error: null }));
    setIsLoading(true);

    try {
      setState((prev) => ({ ...prev, step: 'syncing' }));

      const syncData = await api.tradeRepublic.completeLogin(state.sessionId, verifyCode);

      // Clear verification code
      setVerifyCode('');

      if (!syncData.success) {
        throw new Error(syncData.error || 'Failed to fetch Trade Republic data');
      }

      setState((prev) => ({ ...prev, syncData, step: 'importing' }));

      // Step 3: Import data to database using TanStack Query mutation
      // This ensures proper cache invalidation and error handling
      const importResult = await importMutation.mutateAsync({
        transactions: syncData.transactions,
        positions: syncData.positions,
        cashBalances: syncData.cashBalances,
      });

      setState((prev) => ({
        ...prev,
        importResult,
        step: 'result',
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sync failed',
        step: 'verification',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    if (!state.sessionId) return;

    try {
      await api.tradeRepublic.resendCode(state.sessionId);
      setState((prev) => ({ ...prev, error: null }));
    } catch (error: unknown) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to resend code',
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            Sync Trade Republic
          </DialogTitle>
          <DialogDescription>Securely sync your Trade Republic portfolio data.</DialogDescription>
        </DialogHeader>

        {/* Security Notice */}
        {state.step === 'credentials' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Lock className="size-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-primary">Your credentials are secure</p>
                  <ul className="mt-1 text-muted-foreground space-y-1">
                    <li>- Sent directly to Trade Republic, never stored</li>
                    <li>- Session expires in 2 minutes</li>
                    <li>- Requires 2FA confirmation on your phone</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {state.error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-4 flex items-start gap-2">
              <AlertTriangle className="size-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{state.error}</p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Credentials Form */}
        {state.step === 'credentials' && (
          <form onSubmit={handleSubmitCredentials} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+49123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                pattern="^\+[0-9]{10,15}$"
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +49 for Germany)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                placeholder="****"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Your 4-digit Trade Republic PIN</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !phoneNumber || pin.length !== 4}>
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Step 2: Verification Code */}
        {state.step === 'verification' && (
          <form onSubmit={handleSubmitCode} className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Smartphone className="size-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Check your Trade Republic app</p>
                    <p className="text-muted-foreground mt-1">
                      A 4-digit verification code has been sent to your device.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="code">Verification Code</Label>
                <span
                  className={cn(
                    'text-xs',
                    timeRemaining < 30 ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  Expires in {Math.floor(timeRemaining / 60)}:
                  {(timeRemaining % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <Input
                id="code"
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                placeholder="****"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResendCode}
              className="w-full"
            >
              <RefreshCw className="size-4" />
              Resend Code
            </Button>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || verifyCode.length !== 4}>
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Sync'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Step 3: Syncing/Importing Progress */}
        {(state.step === 'syncing' || state.step === 'importing') && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="size-12 animate-spin mx-auto text-primary" />
            <div>
              <p className="font-medium">
                {state.step === 'syncing'
                  ? 'Fetching data from Trade Republic...'
                  : 'Importing to your portfolio...'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {state.step === 'result' && state.importResult && (
          <div className="space-y-4">
            <Card
              className={
                state.importResult.success
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-destructive'
              }
            >
              <CardContent className="pt-4 flex items-center gap-3">
                {state.importResult.success ? (
                  <Check className="size-6 text-green-500" />
                ) : (
                  <X className="size-6 text-destructive" />
                )}
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      state.importResult.success ? 'text-green-500' : 'text-destructive',
                    )}
                  >
                    {state.importResult.success ? 'Sync Successful!' : 'Sync Completed with Errors'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{state.importResult.transactionsImported}</p>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{state.importResult.positionsCreated}</p>
                  <p className="text-xs text-muted-foreground">Positions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{state.importResult.securitiesCreated}</p>
                  <p className="text-xs text-muted-foreground">Securities</p>
                </CardContent>
              </Card>
            </div>

            {state.importResult.errors.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-yellow-600 mb-2">
                    Warnings ({state.importResult.errors.length})
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
                    {state.importResult.errors.slice(0, 5).map((error) => (
                      <li key={error}>- {error}</li>
                    ))}
                    {state.importResult.errors.length > 5 && (
                      <li>...and {state.importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
