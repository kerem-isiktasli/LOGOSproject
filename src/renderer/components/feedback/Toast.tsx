/**
 * Toast Component
 *
 * 비침습적 알림 시스템. 작업 완료, 오류, 정보를 전달.
 *
 * 철학적 프레임워크:
 * - 손안의 존재: 사용자의 주요 작업을 방해하지 않음
 * - 상태 투사: 시스템 상태를 즉각적으로 전달
 * - 설계적 은폐: 복잡한 오류 스택은 숨기고 핵심 메시지만 표시
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

// Toast Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Toast Icon mapping
const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

// Toast Color mapping
const toastColors: Record<ToastType, { icon: string; bg: string; border: string }> = {
  success: {
    icon: 'var(--pro-success)',
    bg: 'var(--pro-success-muted)',
    border: 'var(--pro-success)',
  },
  error: {
    icon: 'var(--pro-error)',
    bg: 'var(--pro-error-muted)',
    border: 'var(--pro-error)',
  },
  warning: {
    icon: 'var(--pro-warning)',
    bg: 'var(--pro-warning-muted)',
    border: 'var(--pro-warning)',
  },
  info: {
    icon: 'var(--pro-info)',
    bg: 'var(--pro-info-muted)',
    border: 'var(--pro-info)',
  },
};

// Generate unique ID
const generateId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Individual Toast Item
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: () => void;
}> = ({ toast, onRemove }) => {
  const colors = toastColors[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
      }}
      className="pointer-events-auto"
    >
      <div
        className="flex items-start gap-3 p-4 rounded-lg backdrop-blur-xl"
        style={{
          backgroundColor: 'var(--pro-bg-secondary)',
          border: `1px solid ${colors.border}40`,
          boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.3)',
          minWidth: '320px',
          maxWidth: '420px',
        }}
      >
        {/* Icon */}
        <div
          className="flex-shrink-0 mt-0.5"
          style={{ color: colors.icon }}
        >
          {toastIcons[toast.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className="font-medium text-sm"
            style={{ color: 'var(--pro-text-primary)' }}
          >
            {toast.title}
          </div>
          {toast.message && (
            <div
              className="text-sm mt-1"
              style={{ color: 'var(--pro-text-secondary)' }}
            >
              {toast.message}
            </div>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-sm font-medium mt-2 hover:underline"
              style={{ color: colors.icon }}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-1 rounded-md transition-colors hover:bg-white/10"
          style={{ color: 'var(--pro-text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
};

// Toast Provider
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear timer if exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = generateId();
    const duration = toast.duration ?? 4000;

    const newToast: Toast = {
      ...toast,
      id,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss
    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [removeToast]);

  const clearAll = useCallback(() => {
    // Clear all timers
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed top-4 right-4 z-[var(--z-toast)] flex flex-col gap-2 pointer-events-none"
        style={{ zIndex: 80 }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onRemove={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// Hook to use toast
export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Convenience functions
export const toast = {
  success: (title: string, message?: string) => {
    // This will be replaced by actual implementation when provider is mounted
    console.log('Toast success:', title, message);
  },
  error: (title: string, message?: string) => {
    console.log('Toast error:', title, message);
  },
  warning: (title: string, message?: string) => {
    console.log('Toast warning:', title, message);
  },
  info: (title: string, message?: string) => {
    console.log('Toast info:', title, message);
  },
};

export default ToastProvider;
