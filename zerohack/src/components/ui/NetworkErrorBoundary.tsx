'use client';

import { useState, useEffect } from 'react';
import { ErrorDisplay } from './ErrorDisplay';
import { AppError } from '@/lib/errorHandling';

interface NetworkErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

export function NetworkErrorBoundary({ 
  children, 
  fallback,
  onError
}: NetworkErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  
  // Reset the error state
  const reset = () => setError(null);
  
  // Set up an effect that creates a global fetch error handler
  useEffect(() => {
    // Store the original fetch function
    const originalFetch = window.fetch;
    
    // Replace with our own that has error handling
    window.fetch = async function(input, init) {
      try {
        const response = await originalFetch(input, init);
        
        // If response is not ok, treat as an error but preserve the response
        if (!response.ok) {
          const networkError = AppError.fromResponse(response);
          
          // Only set the error for server errors (5xx), not client errors (4xx)
          // as client errors are often expected and should be handled by the component
          if (response.status >= 500) {
            setError(networkError);
            if (onError) onError(networkError);
          }
        }
        
        return response;
      } catch (fetchError) {
        // For network errors (offline, etc.)
        const error = fetchError instanceof Error 
          ? fetchError 
          : new Error(String(fetchError));
        
        const networkError = new AppError({
          message: 'Network connection issue',
          code: 'NETWORK_ERROR',
          technical: error.message,
          context: { url: typeof input === 'string' ? input : '' }
        });
        
        // Set the error state to trigger re-render with error boundary fallback
        setError(networkError);
        if (onError) onError(networkError);
        
        // Re-throw so the calling code knows something went wrong
        throw networkError;
      }
    };
    
    // Clean up when unmounting
    return () => {
      window.fetch = originalFetch;
    };
  }, [onError]);
  
  // If there's an error, show the error display
  if (error) {
    return fallback || (
      <div className="p-6">
        <ErrorDisplay 
          error={error}
          reset={reset}
          showTechnicalDetails={process.env.NODE_ENV === 'development'}
        />
      </div>
    );
  }
  
  // Otherwise, render the children
  return <>{children}</>;
}
