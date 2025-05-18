import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { AppError } from './errorHandling'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely execute a function and handle any errors
 * @param fn Function to execute
 * @param fallback Fallback value to return if the function throws
 * @param errorHandler Optional function to handle the error
 * @returns Result of the function or fallback value
 */
export function safeExecute<T>(
  fn: () => T,
  fallback: T,
  errorHandler?: (error: Error) => void
): T {
  try {
    return fn();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error instanceof Error ? error : new Error(String(error)));
    }
    return fallback;
  }
}

/**
 * Safely parse JSON with error handling
 * @param json JSON string to parse
 * @param fallback Fallback value to return if parsing fails
 * @returns Parsed JSON or fallback value
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely access nested object properties
 * @param obj Object to access
 * @param path Path to the property (e.g., 'user.profile.name')
 * @param fallback Fallback value if the property doesn't exist
 * @returns The property value or fallback
 */
export function safeGet<T>(
  obj: any,
  path: string,
  fallback: T
): T {
  try {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined) {
        return fallback;
      }
      result = result[key];
    }
    
    return (result === null || result === undefined) ? fallback : result as T;
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely store value in localStorage with error handling
 * @param key Storage key
 * @param value Value to store
 * @returns Boolean indicating success
 */
export function safeLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Safely retrieve value from localStorage with error handling
 * @param key Storage key
 * @param fallback Fallback value if retrieval fails
 * @returns Retrieved value or fallback
 */
export function safeLocalStorageGet(key: string, fallback: string): string {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Async function wrapper with error handling
 * @param promise Promise to await
 * @returns Tuple of [data, error]
 */
export async function safeAwait<T>(
  promise: Promise<T>
): Promise<[T | null, Error | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [
      null,
      error instanceof Error ? error : new AppError({
        message: 'An unexpected error occurred',
        technical: String(error)
      })
    ];
  }
}
