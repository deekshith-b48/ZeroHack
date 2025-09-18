'use client';

import { useEffect, useRef, useCallback } from 'react';

interface PerformanceOptimizationOptions {
  enableVirtualScrolling?: boolean;
  enableMemoization?: boolean;
  enableDebouncing?: boolean;
  debounceDelay?: number;
  maxRendersPerSecond?: number;
}

export function usePerformanceOptimization(options: PerformanceOptimizationOptions = {}) {
  const {
    enableVirtualScrolling = true,
    enableMemoization = true,
    enableDebouncing = true,
    debounceDelay = 300,
    maxRendersPerSecond = 60
  } = options;

  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const frameIdRef = useRef<number | null>(null);

  // Throttle renders to maintain 60fps
  const throttledRender = useCallback((callback: () => void) => {
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    const minRenderInterval = 1000 / maxRendersPerSecond;

    if (timeSinceLastRender >= minRenderInterval) {
      callback();
      lastRenderTimeRef.current = now;
      renderCountRef.current++;
    } else {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      
      frameIdRef.current = requestAnimationFrame(() => {
        callback();
        lastRenderTimeRef.current = performance.now();
        renderCountRef.current++;
      });
    }
  }, [maxRendersPerSecond]);

  // Performance monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      const fps = renderCountRef.current;
      renderCountRef.current = 0;
      
      if (fps < 30) {
        console.warn(`Low FPS detected: ${fps} renders in the last second`);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, []);

  // Memory usage monitoring
  useEffect(() => {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        if (memory) {
          const usedMB = memory.usedJSHeapSize / 1024 / 1024;
          const totalMB = memory.totalJSHeapSize / 1024 / 1024;
          
          if (usedMB / totalMB > 0.8) {
            console.warn(`High memory usage: ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB`);
          }
        }
      };

      const interval = setInterval(checkMemory, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  return {
    throttledRender,
    enableVirtualScrolling,
    enableMemoization,
    enableDebouncing,
    debounceDelay
  };
}
