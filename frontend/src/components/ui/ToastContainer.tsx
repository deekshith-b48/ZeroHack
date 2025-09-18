'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ErrorToast } from './ErrorToast';
import { createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppError } from '@/lib/errorHandling';

// Define the shape of a toast notification
interface Toast {
  id: string;
  message: string;
  error?: Error | AppError;
  severity?: 'error' | 'warning' | 'success' | 'info';
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

// Define the context type
interface ToastContextType {
  showToast: (options: Omit<Toast, 'id'>) => string;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
}

// Create the context with default values
const ToastContext = createContext<ToastContextType>({
  showToast: () => '',
  hideToast: () => {},
  clearAllToasts: () => {},
});

// Hook to use the toast functionality
export const useToast = () => useContext(ToastContext);

// Provider component for the toast context
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add a new toast
  const showToast = useCallback((options: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast = { id, ...options };
    
    setToasts(prevToasts => [...prevToasts, newToast]);
    
    return id;
  }, []);

  // Remove a toast by ID
  const hideToast = useCallback((id: string) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // Clear all toasts
  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Remove toasts automatically after their duration
  useEffect(() => {
    const timeouts = toasts
      .filter(toast => toast.duration !== undefined && toast.duration > 0)
      .map(toast => {
        return setTimeout(() => {
          hideToast(toast.id);
        }, toast.duration);
      });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [toasts, hideToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, clearAllToasts }}>
      {children}
      
      {/* Toast container - positioned at the top-right of the screen */}
      <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2 max-w-sm">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorToast
                message={toast.message}
                error={toast.error}
                severity={toast.severity}
                duration={toast.duration}
                onDismiss={() => hideToast(toast.id)}
                actionLabel={toast.actionLabel}
                onAction={toast.onAction}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
