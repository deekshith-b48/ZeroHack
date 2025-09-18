'use client';

import React from 'react';
import { AlertTriangle, XCircle, AlertOctagon, RefreshCw, Copy, ArrowLeft, CheckCircle } from 'lucide-react';
import { AppError, ErrorSeverity, getUserFriendlyMessage, getSuggestedActions } from '@/lib/errorHandling';
import { useRouter } from 'next/navigation';

interface ErrorDisplayProps {
  error: Error | AppError;
  reset?: () => void;
  showTechnicalDetails?: boolean;
  showReportButton?: boolean;
}

export function ErrorDisplay({
  error,
  reset,
  showTechnicalDetails = false,
  showReportButton = true
}: ErrorDisplayProps) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const [reportSent, setReportSent] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState(false);
  
  // Convert any error to AppError for consistent handling
  const appError = error instanceof AppError ? error : AppError.fromError(error);
  
  // Get user-friendly message and actions
  const userMessage = getUserFriendlyMessage(appError.code);
  const suggestedActions = getSuggestedActions(appError);
  
  // Generate error details for technical users
  const errorDetails = JSON.stringify({
    message: appError.message,
    code: appError.code,
    technical: appError.technical,
    timestamp: new Date(appError.timestamp).toISOString(),
    context: appError.context,
    stack: appError.stack
  }, null, 2);
  
  // Handler for reporting the error
  const handleReport = async () => {
    try {
      await fetch('/api/report-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: appError.toJSON(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now()
        })
      });
      setReportSent(true);
    } catch (e) {
      console.error('Failed to send error report:', e);
      // Fallback for when the API is unavailable
      localStorage.setItem('pending-error-reports', JSON.stringify([
        ...JSON.parse(localStorage.getItem('pending-error-reports') || '[]'),
        {
          error: appError.toJSON(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now()
        }
      ]));
      setReportSent(true);
    }
  };
  
  // Copy error details to clipboard
  const copyErrorDetails = () => {
    navigator.clipboard.writeText(errorDetails).then(
      () => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      },
      (err) => console.error('Could not copy text: ', err)
    );
  };
  
  // Get appropriate icon based on severity
  const getErrorIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-12 h-12 text-red-500" />;
      case 'high':
        return <AlertOctagon className="w-12 h-12 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-12 h-12 text-zinc-500" />;
    }
  };
  
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-lg max-w-2xl mx-auto">
      <div className="flex flex-col items-center text-center mb-6">
        {getErrorIcon(appError.severity)}
        <h2 className="text-xl font-semibold mt-4 mb-2 text-white">{userMessage}</h2>
        <p className="text-zinc-400">{appError.message}</p>
      </div>
      
      {suggestedActions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Suggested Actions:</h3>
          <ul className="space-y-2">
            {suggestedActions.map((action, index) => (
              <li key={index} className="flex items-start">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-xs text-zinc-400 mr-2 mt-0.5">
                  {index + 1}
                </span>
                <span className="text-zinc-300">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex flex-wrap gap-3 mb-6">
        {reset && (
          <button
            onClick={() => reset()}
            className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        )}
        
        <button
          onClick={() => router.back()}
          className="flex items-center px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </button>
        
        {showReportButton && !reportSent && (
          <button
            onClick={handleReport}
            className="flex items-center px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors ml-auto"
          >
            Report Issue
          </button>
        )}
        
        {reportSent && (
          <div className="ml-auto flex items-center text-emerald-500">
            <CheckCircle className="w-4 h-4 mr-2" />
            Issue Reported
          </div>
        )}
      </div>
      
      {(process.env.NODE_ENV === 'development' || showTechnicalDetails) && (
        <div className="mt-6 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-zinc-400 hover:text-zinc-300 flex items-center transition-colors"
            >
              {expanded ? 'Hide' : 'Show'} Technical Details
              <ChevronUpDown className={`w-4 h-4 ml-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            
            {expanded && (
              <button
                onClick={copyErrorDetails}
                className="text-sm text-zinc-400 hover:text-zinc-300 flex items-center transition-colors"
              >
                <Copy className="w-4 h-4 mr-1" />
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          
          {expanded && (
            <pre className="bg-zinc-800 text-zinc-300 p-4 rounded-md overflow-auto text-xs mt-2 max-h-64">
              {errorDetails}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// Additional icon component for technical details toggle
function ChevronUpDown({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  );
}
