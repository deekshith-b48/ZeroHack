'use client';

import { captureException as sentryCaptureException } from '@sentry/react';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorDetails {
  message: string;
  code?: string;
  severity?: ErrorSeverity;
  technical?: string;
  timestamp: number;
  componentStack?: string;
  context?: Record<string, unknown>;
}

/**
 * Error class with additional metadata for structured error handling
 */
export class AppError extends Error {
  code: string;
  severity: ErrorSeverity;
  technical: string;
  timestamp: number;
  context: Record<string, unknown>;

  constructor({
    message,
    code = 'UNKNOWN_ERROR',
    severity = 'medium',
    technical = '',
    context = {}
  }: {
    message: string;
    code?: string;
    severity?: ErrorSeverity;
    technical?: string;
    context?: Record<string, unknown>;
  }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.severity = severity;
    this.technical = technical || message;
    this.timestamp = Date.now();
    this.context = context;
    
    // Ensures proper instanceof checks work with this custom error
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): ErrorDetails {
    return {
      message: this.message,
      code: this.code,
      severity: this.severity,
      technical: this.technical,
      timestamp: this.timestamp,
      context: this.context
    };
  }

  static fromError(error: Error, additionalContext: Record<string, unknown> = {}): AppError {
    if (error instanceof AppError) {
      // Merge additional context with existing context
      error.context = { ...error.context, ...additionalContext };
      return error;
    }

    return new AppError({
      message: 'An unexpected error occurred',
      technical: `${error.name}: ${error.message}`,
      context: {
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...additionalContext
        }
      }
    });
  }

  static fromResponse(response: Response): AppError {
    return new AppError({
      message: 'Server request failed',
      code: `HTTP_${response.status}`,
      severity: response.status >= 500 ? 'high' : 'medium',
      technical: `HTTP ${response.status}: ${response.statusText}`,
      context: {
        url: response.url,
        status: response.status,
        statusText: response.statusText
      }
    });
  }
}

// Maps error codes to user-friendly messages
const errorMessages: Record<string, string> = {
  'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection and try again.',
  'UNAUTHORIZED': 'You need to sign in to access this feature.',
  'FORBIDDEN': 'You don\'t have permission to access this resource.',
  'NOT_FOUND': 'The requested resource was not found.',
  'HTTP_500': 'We\'re experiencing technical difficulties. Please try again later.',
  'HTTP_503': 'Service temporarily unavailable. We\'re working to restore it as quickly as possible.',
  'API_ERROR': 'There was an error processing your request.',
  'CLIENT_ERROR': 'Something went wrong in your browser. Please refresh the page and try again.',
  'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again later.'
};

// Get user-friendly error message based on error code
export function getUserFriendlyMessage(errorCode: string): string {
  return errorMessages[errorCode] || errorMessages.UNKNOWN_ERROR;
}

// Determine if an error is recoverable
export function isRecoverableError(error: AppError): boolean {
  // Network errors are typically recoverable through retries
  if (error.code === 'NETWORK_ERROR') return true;
  
  // Temporary server issues
  if (['HTTP_500', 'HTTP_502', 'HTTP_503', 'HTTP_504'].includes(error.code)) return true;
  
  // Unrecoverable errors
  if (['FATAL_ERROR', 'MEMORY_ERROR', 'SECURITY_VIOLATION'].includes(error.code)) return false;
  
  // By default, consider errors potentially recoverable
  return true;
}

// Determine suggested user actions based on error
export function getSuggestedActions(error: AppError): string[] {
  const actions: string[] = [];
  
  switch (error.code) {
    case 'NETWORK_ERROR':
      actions.push('Check your internet connection');
      actions.push('Try refreshing the page');
      break;
    case 'UNAUTHORIZED':
      actions.push('Sign in to your account');
      actions.push('Check if your session has expired');
      break;
    case 'HTTP_404':
      actions.push('Check if the URL is correct');
      actions.push('Go back to the home page');
      break;
    case 'HTTP_500':
    case 'HTTP_503':
      actions.push('Wait a few minutes and try again');
      actions.push('Contact support if the problem persists');
      break;
    default:
      actions.push('Try refreshing the page');
      actions.push('Restart your browser if the problem persists');
  }
  
  return actions;
}

// Store error in browser's localStorage for persistence
export function storeError(error: AppError): string {
  const errorId = `error-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const serializedError = JSON.stringify(error.toJSON());
  
  try {
    // Store in localStorage for persistence
    const storedErrors = JSON.parse(localStorage.getItem('app-errors') || '{}');
    storedErrors[errorId] = serializedError;
    
    // Limit stored errors to prevent localStorage overflow
    const errorIds = Object.keys(storedErrors);
    if (errorIds.length > 50) {
      // Remove oldest errors if we have too many
      const oldestErrorIds = errorIds.slice(0, errorIds.length - 50);
      oldestErrorIds.forEach(id => delete storedErrors[id]);
    }
    
    localStorage.setItem('app-errors', JSON.stringify(storedErrors));
  } catch (e) {
    console.warn('Failed to store error in localStorage:', e);
  }
  
  return errorId;
}

// Report error to analytics/monitoring service
export function reportError(error: Error, componentStack?: string): void {
  const appError = error instanceof AppError 
    ? error 
    : AppError.fromError(error);
  
  // Capture exception for Sentry or similar service
  try {
    // Add component stack if available
    if (componentStack) {
      appError.context.componentStack = componentStack;
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('Error Captured');
      console.error(appError);
      if (componentStack) {
        console.error('Component Stack:', componentStack);
      }
      console.groupEnd();
    }
    
    // Store in localStorage
    const errorId = storeError(appError);
    appError.context.errorId = errorId;
    
    // Send to error monitoring service
    sentryCaptureException(error, {
      extra: {
        ...appError.context,
        componentStack
      }
    });
  } catch (reportError) {
    // Fallback if reporting itself fails
    console.error('Error reporting failed:', reportError);
    console.error('Original error:', error);
  }
}

// Global error handler for unhandled errors
export function setupGlobalErrorHandlers(): void {
  if (typeof window !== 'undefined') {
    // Uncaught exceptions
    window.addEventListener('error', (event) => {
      reportError(event.error || new Error(event.message));
      // Don't prevent default to allow browser's default error handling
    });
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      reportError(error);
    });
    
    // Network errors on fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      try {
        const response = await originalFetch(input, init);
        
        // Handle HTTP error responses
        if (!response.ok) {
          const appError = AppError.fromResponse(response);
          reportError(appError);
          
          // Don't throw for 4xx errors, let the calling code handle them
          if (response.status >= 500) {
            throw appError;
          }
        }
        
        return response;
      } catch (error) {
        // Handle network errors
        if (error instanceof TypeError && error.message.includes('NetworkError')) {
          const networkError = new AppError({
            message: 'Network connection issue',
            code: 'NETWORK_ERROR',
            technical: error.message,
            context: { 
              url: typeof input === 'string' ? input : 
                   input instanceof URL ? input.toString() : 
                   input instanceof Request ? input.url : 'unknown'
            }
          });
          
          reportError(networkError);
          throw networkError;
        }
        
        // Re-throw other errors
        throw error;
      }
    };
  }
}

// Helper to retry failed operations
export async function withRetry<T>(
  operation: () => Promise<T>, 
  options: { 
    retries?: number; 
    delay?: number; 
    onRetry?: (attempt: number, error: Error) => void;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const { 
    retries = 3, 
    delay = 1000, 
    onRetry = () => {}, 
    shouldRetry = () => true 
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if we've reached max retries or if shouldRetry returns false
      if (attempt === retries || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      // Call onRetry callback
      onRetry(attempt + 1, lastError);
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  
  // This should never happen, but TS needs it
  throw lastError!;
}
