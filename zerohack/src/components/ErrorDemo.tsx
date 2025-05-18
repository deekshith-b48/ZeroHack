'use client';

import React, { useState } from 'react';
import { AppError, reportError } from '@/lib/errorHandling';
import { useToast } from '@/components/ui/ToastContainer';
import { safeAwait } from '@/lib/utils';

export default function ErrorDemo() {
  const { showToast } = useToast();
  const [errorType, setErrorType] = useState<string>('javascript');
  
  // Trigger different types of errors for demonstration
  const triggerError = () => {
    switch (errorType) {
      case 'javascript':
        try {
          // @ts-ignore - Intentional error for demonstration
          const obj = null;
          obj.nonExistentMethod();
        } catch (error) {
          if (error instanceof Error) {
            reportError(error);
            showToast({
              message: 'JavaScript Error Triggered',
              error: error,
              severity: 'error'
            });
          }
        }
        break;
        
      case 'network':
        // Trigger a network error by attempting to fetch from a non-existent endpoint
        fetch('/api/non-existent-endpoint')
          .then(response => {
            if (!response.ok) {
              throw new AppError({
                message: 'Failed to fetch data',
                code: `HTTP_${response.status}`,
                technical: `HTTP ${response.status}: ${response.statusText}`,
              });
            }
            return response.json();
          })
          .catch(error => {
            reportError(error);
            showToast({
              message: 'Network Error Triggered',
              error,
              severity: 'warning'
            });
          });
        break;
        
      case 'async':
        // Demonstrate safe async error handling
        const fetchData = async () => {
          const [data, error] = await safeAwait(
            fetch('/api/non-existent').then(res => res.json())
          );
          
          if (error) {
            reportError(error);
            showToast({
              message: 'Async Error Handled Safely',
              error,
              severity: 'info',
              actionLabel: 'View Details',
              onAction: () => alert(JSON.stringify(error, null, 2))
            });
          }
        };
        
        fetchData();
        break;
        
      case 'custom':
        // Create and throw a custom application error
        const customError = new AppError({
          message: 'This is a custom application error',
          code: 'CUSTOM_ERROR',
          severity: 'medium',
          technical: 'Technical details that should only be shown to developers',
          context: {
            userId: '123',
            timestamp: new Date().toISOString(),
            action: 'demonstration'
          }
        });
        
        reportError(customError);
        showToast({
          message: 'Custom Error Triggered',
          error: customError,
          severity: 'error'
        });
        break;
        
      case 'render':
        // This will trigger the ErrorBoundary
        setTimeout(() => {
          throw new Error('Rendering Error Simulation');
        }, 0);
        break;
    }
  };
  
  return (
    <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-800">
      <h2 className="text-xl font-semibold mb-4">Error Handling Demonstration</h2>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center">
            <input 
              type="radio" 
              name="errorType" 
              value="javascript" 
              checked={errorType === 'javascript'} 
              onChange={(e) => setErrorType(e.target.value)}
              className="mr-2"
            />
            JavaScript Error
          </label>
          <label className="flex items-center">
            <input 
              type="radio" 
              name="errorType" 
              value="network" 
              checked={errorType === 'network'} 
              onChange={(e) => setErrorType(e.target.value)}
              className="mr-2"
            />
            Network Error
          </label>
          <label className="flex items-center">
            <input 
              type="radio" 
              name="errorType" 
              value="async" 
              checked={errorType === 'async'} 
              onChange={(e) => setErrorType(e.target.value)}
              className="mr-2"
            />
            Async Error
          </label>
          <label className="flex items-center">
            <input 
              type="radio" 
              name="errorType" 
              value="custom" 
              checked={errorType === 'custom'} 
              onChange={(e) => setErrorType(e.target.value)}
              className="mr-2"
            />
            Custom Error
          </label>
          <label className="flex items-center">
            <input 
              type="radio" 
              name="errorType" 
              value="render" 
              checked={errorType === 'render'} 
              onChange={(e) => setErrorType(e.target.value)}
              className="mr-2"
            />
            Render Error
          </label>
        </div>
        
        <button
          onClick={triggerError}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
        >
          Trigger {errorType.charAt(0).toUpperCase() + errorType.slice(1)} Error
        </button>
        
        <div className="text-sm text-zinc-400 mt-2">
          <p>This component demonstrates different types of errors and how they are handled:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li><strong>JavaScript Error:</strong> Shows how runtime JS errors are captured and reported</li>
            <li><strong>Network Error:</strong> Demonstrates handling of API/fetch failures</li>
            <li><strong>Async Error:</strong> Shows safe error handling for asynchronous operations</li>
            <li><strong>Custom Error:</strong> Demonstrates structured error reporting with AppError</li>
            <li><strong>Render Error:</strong> Triggers the React ErrorBoundary for component failures</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
