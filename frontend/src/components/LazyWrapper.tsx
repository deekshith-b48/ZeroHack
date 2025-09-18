'use client';

import { Suspense, lazy, ComponentType } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface LazyWrapperProps {
  fallback?: React.ReactNode;
  delay?: number;
}

export function createLazyComponent<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc);

  return function LazyWrapper(props: React.ComponentProps<T> & LazyWrapperProps) {
    const { fallback: customFallback, delay = 200, ...componentProps } = props;
    
    const defaultFallback = (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading component..." />
      </div>
    );

    return (
      <Suspense fallback={customFallback || defaultFallback}>
        <LazyComponent {...componentProps} />
      </Suspense>
    );
  };
}

// Pre-configured lazy components
export const LazyEDRStatus = createLazyComponent(
  () => import('./dashboard/EDRStatus').then(m => ({ default: m.EDRStatus }))
);

export const LazyProcessMonitor = createLazyComponent(
  () => import('./dashboard/ProcessMonitor').then(m => ({ default: m.ProcessMonitor }))
);

export const LazyThreatTriage = createLazyComponent(
  () => import('./dashboard/ThreatTriage').then(m => ({ default: m.ThreatTriage }))
);

export const LazyAIDetection = createLazyComponent(
  () => import('./dashboard/AIDetection').then(m => ({ default: m.AIDetection }))
);
