'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info as InfoIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppError } from '@/lib/errorHandling';

interface ErrorToastProps {
  error?: Error | AppError | null;
  message?: string;
  duration?: number;
  onDismiss?: () => void;
  showProgress?: boolean;
  severity?: 'error' | 'warning' | 'success' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorToast({
  error,
  message,
  duration = 5000,
  onDismiss,
  showProgress = true,
  severity = 'error',
  actionLabel,
  onAction
}: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Get appropriate error message
  const displayMessage = message || (error instanceof AppError ? error.message : error?.message || 'An error occurred');

  useEffect(() => {
    if (duration && showProgress) {
      // Calculate how often to update the progress bar for smooth animation
      const updateInterval = 10; // Update every 10ms
      const decrementAmount = (updateInterval / duration) * 100;
      
      // Set up the interval to update progress
      const id = setInterval(() => {
        setProgress(currentProgress => {
          const newProgress = currentProgress - decrementAmount;
          
          // When we reach zero, clear the interval and dismiss
          if (newProgress <= 0) {
            clearInterval(id);
            handleDismiss();
            return 0;
          }
          
          return newProgress;
        });
      }, updateInterval);
      
      setIntervalId(id);
      
      // Clean up on unmount
      return () => {
        if (id) clearInterval(id);
      };
    }
  }, [duration, showProgress]);

  // Handle dismissing the toast
  const handleDismiss = (): void => {
    setIsVisible(false);
    
    // Clear any running intervals
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    // Call onDismiss after exit animation completes
    setTimeout(() => {
      onDismiss?.();
    }, 300); // Match animation duration
  };

  // Determine the appropriate color for the toast based on severity
  const getSeverityStyles = (): {
    bgColor: string;
    borderColor: string;
    textColor: string;
    icon: React.ReactNode;
  } => {
    switch (severity) {
      case 'error':
        return {
          bgColor: 'bg-red-900 bg-opacity-20',
          borderColor: 'border-red-800',
          textColor: 'text-red-500',
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />
        };
      case 'warning':
        return {
          bgColor: 'bg-yellow-900 bg-opacity-20',
          borderColor: 'border-yellow-800',
          textColor: 'text-yellow-500',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />
        };
      case 'success':
        return {
          bgColor: 'bg-green-900 bg-opacity-20',
          borderColor: 'border-green-800',
          textColor: 'text-green-500',
          icon: <CheckCircle className="w-5 h-5 text-green-500" />
        };
      case 'info':
      default:
        return {
          bgColor: 'bg-blue-900 bg-opacity-20',
          borderColor: 'border-blue-800',
          textColor: 'text-blue-500',
          icon: <InfoIcon className="w-5 h-5 text-blue-500" />
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`${styles.bgColor} border ${styles.borderColor} rounded-md shadow-lg w-full max-w-sm`}
          role="alert"
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {styles.icon}
              </div>
              <div className="ml-3 flex-1">
                <p className={`text-sm font-medium ${styles.textColor}`}>
                  {displayMessage}
                </p>
                {error && process.env.NODE_ENV === 'development' && (
                  <p className="mt-1 text-xs text-zinc-400 truncate max-w-[250px]">
                    {error instanceof AppError ? error.technical : error.toString()}
                  </p>
                )}
                
                {actionLabel && onAction && (
                  <button
                    onClick={onAction}
                    className={`mt-2 text-xs font-medium ${styles.textColor} hover:underline`}
                  >
                    {actionLabel}
                  </button>
                )}
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="bg-transparent rounded-md inline-flex text-zinc-400 hover:text-zinc-200 focus:outline-none"
                  onClick={handleDismiss}
                >
                  <span className="sr-only">Close</span>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
          
          {showProgress && duration > 0 && (
            <div className="w-full bg-zinc-800 rounded-b-md h-1">
              <div 
                className={`h-1 ${severity === 'error' ? 'bg-red-500' : 
                              severity === 'warning' ? 'bg-yellow-500' : 
                              severity === 'success' ? 'bg-green-500' : 
                              'bg-blue-500'} rounded-b-md transition-all duration-100 ease-linear`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
