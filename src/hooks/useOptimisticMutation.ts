import { useState } from 'react';
import { PersistedState } from '../types';

interface UseOptimisticMutationOptions {
  apiStatus: 'connecting' | 'online' | 'offline';
  hasLoadedRemote: boolean;
  applyPersistedState: (state: PersistedState) => void;
  setApiStatus: (status: 'connecting' | 'online' | 'offline') => void;
}

interface MutationOptions {
  request: () => Promise<PersistedState>;
  fallback: () => void;
  errorMessage: string;
  clearError?: boolean;
}

export function useOptimisticMutation({
  apiStatus,
  hasLoadedRemote,
  applyPersistedState,
  setApiStatus,
}: UseOptimisticMutationOptions) {
  const [mutationError, setMutationError] = useState<string | null>(null);

  const runMutation = async ({
    request,
    fallback,
    errorMessage,
    clearError = true,
  }: MutationOptions) => {
    if (clearError) {
      setMutationError(null);
    }

    fallback();

    if (!hasLoadedRemote || apiStatus !== 'online') {
      return;
    }

    try {
      const state = await request();
      applyPersistedState(state);
      setApiStatus('online');
    } catch (error) {
      setApiStatus('offline');
      if (error instanceof Error && error.message) {
        setMutationError(`${errorMessage} ${error.message}`);
      } else {
        setMutationError(errorMessage);
      }
    }
  };

  return {
    mutationError,
    setMutationError,
    runMutation,
  };
}
