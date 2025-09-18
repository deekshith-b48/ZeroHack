'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function BackButton() {
  return (
    <button 
      onClick={() => history.back()}
      className="flex items-center justify-center px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Go Back
    </button>
  );
}
