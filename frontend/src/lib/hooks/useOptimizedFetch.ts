'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface UseOptimizedFetchOptions {
  ttl?: number; // Time to live in milliseconds
  retryAttempts?: number;
  retryDelay?: number;
  enabled?: boolean;
}

export function useOptimizedFetch<T>(
  url: string,
  options: UseOptimizedFetchOptions = {}
) {
  const {
    ttl = 30000, // 30 seconds default
    retryAttempts = 3,
    retryDelay = 1000,
    enabled = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    const cacheKey = url;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && cached && (now - cached.timestamp) < cached.ttl) {
      setData(cached.data);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          signal: abortControllerRef.current.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Cache the result
        cacheRef.current.set(cacheKey, {
          data: result,
          timestamp: now,
          ttl
        });

        setData(result);
        setError(null);
        break;

      } catch (err) {
        lastError = err as Error;
        
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Request was cancelled
        }

        if (attempt < retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        }
      }
    }

    if (lastError) {
      setError(lastError.message);
    }

    setLoading(false);
  }, [url, ttl, retryAttempts, retryDelay, enabled]);

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    clearCache
  };
}
