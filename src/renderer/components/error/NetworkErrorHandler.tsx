/**
 * NetworkErrorHandler Component
 *
 * Handles network connectivity issues with automatic retry.
 * Monitors online/offline status and provides recovery UI.
 *
 * Features:
 * - Detects offline status
 * - Auto-reconnect on network recovery
 * - Queues failed requests for retry
 * - Toast notifications for status changes
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../feedback/Toast';

// ============================================================================
// Types
// ============================================================================

interface NetworkState {
  isOnline: boolean;
  isReconnecting: boolean;
  lastError: NetworkError | null;
  failedRequests: FailedRequest[];
}

interface NetworkError {
  type: 'network' | 'timeout' | 'server';
  message: string;
  timestamp: Date;
  endpoint?: string;
}

interface FailedRequest {
  id: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

interface NetworkContextValue extends NetworkState {
  retry: () => Promise<void>;
  clearError: () => void;
  addFailedRequest: (request: Omit<FailedRequest, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFailedRequest: (id: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const NetworkContext = createContext<NetworkContextValue | null>(null);

export const useNetwork = (): NetworkContextValue => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkErrorHandler');
  }
  return context;
};

// ============================================================================
// Provider Component
// ============================================================================

interface NetworkErrorHandlerProps {
  children: ReactNode;
  onReconnect?: () => Promise<void>;
  showBanner?: boolean;
}

export const NetworkErrorHandler: React.FC<NetworkErrorHandlerProps> = ({
  children,
  onReconnect,
  showBanner = true,
}) => {
  const [state, setState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isReconnecting: false,
    lastError: null,
    failedRequests: [],
  });

  const { addToast } = useToast();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      addToast({
        type: 'success',
        title: '연결됨',
        message: '네트워크 연결이 복구되었습니다.',
        duration: 3000,
      });

      // Auto-retry failed requests
      handleReconnect();
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        isOnline: false,
        lastError: {
          type: 'network',
          message: '인터넷 연결이 끊어졌습니다.',
          timestamp: new Date(),
        },
      }));
      addToast({
        type: 'error',
        title: '오프라인',
        message: '인터넷 연결을 확인해주세요.',
        duration: 0, // Don't auto-dismiss
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast]);

  // Reconnection handler
  const handleReconnect = useCallback(async () => {
    if (state.isReconnecting) return;

    setState(prev => ({ ...prev, isReconnecting: true }));

    try {
      // Call custom reconnection handler if provided
      if (onReconnect) {
        await onReconnect();
      }

      // Retry failed requests
      const retriedRequests: string[] = [];
      for (const request of state.failedRequests) {
        if (request.retryCount < request.maxRetries) {
          // Emit retry event for the request
          window.dispatchEvent(
            new CustomEvent('logos:retry-request', { detail: request })
          );
          retriedRequests.push(request.id);
        }
      }

      // Remove retried requests
      setState(prev => ({
        ...prev,
        failedRequests: prev.failedRequests.filter(r => !retriedRequests.includes(r.id)),
        isReconnecting: false,
        lastError: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isReconnecting: false,
        lastError: {
          type: 'network',
          message: error instanceof Error ? error.message : '재연결 실패',
          timestamp: new Date(),
        },
      }));
    }
  }, [state.isReconnecting, state.failedRequests, onReconnect]);

  // Context actions
  const retry = useCallback(async () => {
    await handleReconnect();
  }, [handleReconnect]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, lastError: null }));
  }, []);

  const addFailedRequest = useCallback((request: Omit<FailedRequest, 'id' | 'timestamp' | 'retryCount'>) => {
    const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setState(prev => ({
      ...prev,
      failedRequests: [
        ...prev.failedRequests,
        {
          ...request,
          id,
          timestamp: new Date(),
          retryCount: 0,
        },
      ],
    }));
  }, []);

  const removeFailedRequest = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      failedRequests: prev.failedRequests.filter(r => r.id !== id),
    }));
  }, []);

  const contextValue: NetworkContextValue = {
    ...state,
    retry,
    clearError,
    addFailedRequest,
    removeFailedRequest,
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
      {showBanner && <OfflineBanner />}
    </NetworkContext.Provider>
  );
};

// ============================================================================
// Offline Banner Component
// ============================================================================

const OfflineBanner: React.FC = () => {
  const { isOnline, isReconnecting, retry, failedRequests } = useNetwork();

  if (isOnline && failedRequests.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50"
        >
          <div
            className="flex items-center justify-center gap-3 py-3 px-4"
            style={{
              backgroundColor: 'var(--pro-warning)',
              color: 'var(--pro-bg-primary)',
            }}
          >
            <WifiOff size={18} />
            <span className="text-sm font-medium">
              오프라인 상태입니다. 인터넷 연결을 확인해주세요.
            </span>
            <button
              onClick={() => retry()}
              disabled={isReconnecting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(0,0,0,0.2)',
              }}
            >
              <RefreshCw
                size={14}
                className={isReconnecting ? 'animate-spin' : ''}
              />
              {isReconnecting ? '재연결 중...' : '재연결'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// Hook for handling API errors with network awareness
// ============================================================================

interface UseNetworkAwareOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
}

export function useNetworkAware<T>(
  asyncFn: () => Promise<T>,
  options: UseNetworkAwareOptions = {}
): {
  execute: () => Promise<T | null>;
  loading: boolean;
  error: Error | null;
  data: T | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const network = useNetwork();

  const { maxRetries = 3, retryDelay = 1000, onError } = options;

  const execute = useCallback(async (): Promise<T | null> => {
    if (!network.isOnline) {
      const offlineError = new Error('오프라인 상태입니다.');
      setError(offlineError);
      onError?.(offlineError);
      return null;
    }

    setLoading(true);
    setError(null);

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const result = await asyncFn();
        setData(result);
        setLoading(false);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempt++;

        // Check if it's a network error
        const isNetworkError =
          lastError.message.toLowerCase().includes('network') ||
          lastError.message.toLowerCase().includes('fetch') ||
          lastError.message.toLowerCase().includes('timeout');

        if (isNetworkError && attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise(resolve =>
            setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
          );
        } else if (!isNetworkError) {
          // Non-network errors don't get retried
          break;
        }
      }
    }

    setError(lastError);
    setLoading(false);
    onError?.(lastError!);

    // Track failed request for potential later retry
    if (lastError) {
      network.addFailedRequest({
        endpoint: 'unknown',
        method: 'GET',
        maxRetries,
      });
    }

    return null;
  }, [asyncFn, maxRetries, retryDelay, network.isOnline, onError]);

  return { execute, loading, error, data };
}

export default NetworkErrorHandler;
