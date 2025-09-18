'use client';

import React, { useCallback } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { ErrorDisplay } from './ErrorDisplay';
import { reportError } from '@/lib/errorHandling';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const handleError = useCallback((error: Error, info: React.ErrorInfo) => {
    reportError(error, info.componentStack || '');
  }, []);

  return (
    <ReactErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        fallback || (
          <div className="p-6">
            <ErrorDisplay 
              error={error}
              reset={resetErrorBoundary}
              showTechnicalDetails={process.env.NODE_ENV === 'development'}
            />
          </div>
        )
      )}
      onError={handleError}
    >
      {children}
    </ReactErrorBoundary>
  );
}
