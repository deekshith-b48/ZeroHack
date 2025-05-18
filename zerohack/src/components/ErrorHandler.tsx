'use client';

import { useEffect } from 'react';
import { setupGlobalErrorHandlers } from '@/lib/errorHandling';

export default function ErrorHandler() {
  useEffect(() => {
    // Set up global error handlers when the component mounts
    setupGlobalErrorHandlers();
    
    // No cleanup needed as we want the handlers to persist
  }, []);

  // This component doesn't render anything
  return null;
}
