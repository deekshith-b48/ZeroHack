'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  isResponsive: boolean;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    isResponsive: true
  });

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let isMonitoring = true;

    const measurePerformance = () => {
      if (!isMonitoring) return;

      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      frameCount++;
      
      // Check if we're maintaining 60fps (16.67ms per frame)
      const isResponsive = deltaTime < 20; // Allow some tolerance
      
      setMetrics(prev => ({
        ...prev,
        renderTime: deltaTime,
        isResponsive,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0
      }));

      lastTime = currentTime;
      
      if (isMonitoring) {
        requestAnimationFrame(measurePerformance);
      }
    };

    requestAnimationFrame(measurePerformance);

    return () => {
      isMonitoring = false;
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-300 z-50">
      <div className="flex items-center space-x-4">
        <div className={`w-2 h-2 rounded-full ${metrics.isResponsive ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span>FPS: {Math.round(1000 / metrics.renderTime)}</span>
        <span>Memory: {Math.round(metrics.memoryUsage / 1024 / 1024)}MB</span>
        <span className={metrics.isResponsive ? 'text-green-400' : 'text-red-400'}>
          {metrics.isResponsive ? 'Responsive' : 'Lagging'}
        </span>
      </div>
    </div>
  );
}


