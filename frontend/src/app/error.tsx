'use client';

import React from 'react';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { reportError } from '@/lib/errorHandling';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Report the error to monitoring service
    reportError(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <ErrorDisplay 
        error={error} 
        reset={reset}
        // In production, we don't want to show the stack trace
        showTechnicalDetails={process.env.NODE_ENV === 'development'}
      />
    </div>
  );
}
