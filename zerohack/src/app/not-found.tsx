import React from 'react';
import Link from 'next/link';
import { Frown, Home, Search } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 shadow-lg max-w-md mx-auto text-center">
        <Frown className="w-16 h-16 text-zinc-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold mb-2 text-white">Page Not Found</h1>
        <p className="text-zinc-400 mb-6">
          Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
        </p>
        
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link 
              href="/"
              className="flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Link>
            <BackButton />
          </div>
          
          <div className="relative mt-6">
            <div className="flex items-center bg-zinc-800 rounded-md overflow-hidden">
              <Search className="w-5 h-5 text-zinc-500 absolute left-3" />
              <input
                type="text"
                placeholder="Search for content..."
                className="bg-transparent text-white w-full py-2 pl-10 pr-4 border-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
